
import React, { useState, FC, useEffect, useMemo } from 'react';
import { db } from '../../database';
import type { Appointment, Representative, Student, CaseFile, FollowUp, User } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from './Modal';
import LoadingSpinner from './LoadingSpinner';
import { PdfGenerator } from '../../utils/pdf';
import { CheckCircle, Download } from 'lucide-react';
import { Utils } from '../../utils/helpers';

interface AttentionModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    appointment?: Appointment;
    representativeId?: number;
}

const AttentionModal: FC<AttentionModalProps> = ({ isOpen, onClose, currentUser, appointment, representativeId }) => {
    const [view, setView] = useState<'form' | 'success' | 'certificate'>('form');
    
    // Form state
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
    const [description, setDescription] = useState('');
    const [observations, setObservations] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [finalAttentionData, setFinalAttentionData] = useState<any>(null);

    const attendeeId = appointment?.attendeeId ?? representativeId;
    const attendeeType = appointment?.attendeeType ?? 'Representante';
    const isRepresentativeAttention = attendeeType === 'Representante';

    const data = useLiveQuery(async () => {
        if (!attendeeId || !isRepresentativeAttention) return null;
        const representative = await db.representatives.get(attendeeId);
        if (!representative) return null;
        const students = await db.students.where('representativeId').equals(attendeeId).toArray();
        const studentIds = students.map(s => s.id!);
        const cases = await db.caseFiles.where('studentId').anyOf(studentIds).and(c => c.status !== 'Cerrado').toArray();
        return { representative, students, cases };
    }, [attendeeId, isRepresentativeAttention]);

    useEffect(() => {
        if (isOpen) {
            // Reset state on open
            setDescription('');
            setObservations('');
            setIsLoading(false);
            
            // Pre-fill from appointment if available
            if (appointment) {
                if (appointment.studentId) {
                    setSelectedStudentId(appointment.studentId);
                }
                if (appointment.caseId) {
                    setSelectedCaseId(appointment.caseId);
                }
            }

            // Determine initial view
            if (appointment && appointment.status === 'Realizada' && isRepresentativeAttention) {
                const [h, m] = appointment.startTime.split(':').map(Number);
                const endDate = new Date();
                endDate.setHours(h + 1, m, 0, 0);
                const endH = String(endDate.getHours()).padStart(2, '0');
                const endM = String(endDate.getMinutes()).padStart(2, '0');

                setStartTime(appointment.startTime);
                setEndTime(appointment.endTime || `${endH}:${endM}`);
                setView('certificate');
            } else {
                 setStartTime(appointment?.startTime || `${new Date().getHours()}:00`);
                 const now = new Date();
                 now.setHours(now.getHours() + 1);
                 const endH = String(now.getHours()).padStart(2, '0');
                 setEndTime(`${endH}:00`);
                 setView('form');
            }

            if (appointment?.attendeeType === 'Estudiante') {
                setSelectedStudentId(appointment.attendeeId);
            }
        } else {
            // Reset selection when modal closes
            setSelectedStudentId(null);
            setSelectedCaseId(null);
        }
    }, [isOpen, appointment, isRepresentativeAttention]);

    const studentCases = useMemo(() => {
        if (!selectedStudentId || !data?.cases) return [];
        return data.cases.filter(c => c.studentId === selectedStudentId);
    }, [selectedStudentId, data?.cases]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description) {
            alert("La descripción de la atención es obligatoria.");
            return;
        }
        if (isRepresentativeAttention && (!selectedStudentId)) {
            alert("Debe seleccionar un estudiante para asociar la atención.");
            return;
        }

        setIsLoading(true);

        try {
            let targetCaseId = selectedCaseId;

            if (!targetCaseId && selectedStudentId) {
                // Try to find an active case if not explicitly selected
                const activeCase = await db.caseFiles.where('studentId').equals(selectedStudentId).filter(c => c.status !== 'Cerrado').first();
                if (activeCase) {
                    targetCaseId = activeCase.id || null;
                } else if (!isRepresentativeAttention) {
                     alert("El estudiante no tiene un expediente de caso activo. Debe crear un caso primero.");
                     setIsLoading(false);
                     return;
                }
            }

            if (!targetCaseId) {
                 if(!window.confirm("No se ha seleccionado un caso específico. La atención se registrará, pero no estará vinculada a un expediente. ¿Desea continuar?")) {
                     setIsLoading(false);
                     return;
                 }
                 // Proceed without caseId (it will be a general attention/appointment log, strictly speaking standard FollowUp requires caseId, but we might need to handle loose attentions or force case creation. 
                 // For now, based on schema, FollowUp NEEDS caseId. So we MUST block if no case found.
                 alert("Error: No se puede registrar un seguimiento sin un Caso asociado. Por favor cree un caso para el estudiante primero o seleccione uno existente.");
                 setIsLoading(false);
                 return;
            }

            const followUpData: FollowUp = {
                caseId: targetCaseId,
                date: appointment?.date || new Date().toISOString().split('T')[0],
                description: description,
                observations: observations,
                responsible: currentUser.nombreCompleto,
                interventionType: 'Individual',
                participantType: [attendeeType],
                isEffective: true,
            };

            await db.followUps.add(followUpData);

            if (appointment) {
                await db.appointments.update(appointment.id!, { status: 'Realizada', startTime, endTime });
            }
            
            setFinalAttentionData({
                representative: data?.representative,
                date: appointment?.date || new Date().toISOString().split('T')[0],
                startTime,
                endTime
            });

            setView('success');

        } catch (error) {
            console.error("Error al registrar atención:", error);
            alert(`Error: ${error}`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleGenerateCertificate = async () => {
        let repData, attData;

        if (view === 'certificate' && appointment && data?.representative) {
            repData = data.representative;
            attData = appointment;
        } else if (view === 'success' && finalAttentionData) {
            repData = finalAttentionData.representative;
            attData = finalAttentionData;
        } else {
            alert("No hay datos suficientes para generar el certificado.");
            return;
        }

        await PdfGenerator.generateAttendanceCertificatePdf({
            representativeName: repData.fullName,
            representativeCedula: repData.cedula,
            date: attData.date,
            startTime: startTime,
            endTime: endTime,
        });
    };

    const renderContent = () => {
        if (isLoading) return <LoadingSpinner />;
        
        switch (view) {
            case 'success':
                return (
                    <div className="text-center">
                        <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                        <h3 className="text-lg font-semibold">Atención Registrada con Éxito</h3>
                        <p className="text-sm text-gray-500 mb-6">El seguimiento ha sido añadido al expediente correspondiente.</p>
                        <div className="flex flex-col sm:flex-row gap-3">
                            {isRepresentativeAttention && (
                                <button onClick={handleGenerateCertificate} className="btn-primary w-full flex-1 flex items-center justify-center gap-2">
                                    <Download size={18} /> Generar Certificado
                                </button>
                            )}
                            <button onClick={onClose} className="btn-secondary w-full flex-1">Cerrar</button>
                        </div>
                    </div>
                );

            case 'certificate':
                 return (
                    <div className="space-y-4">
                        <p>Genere el certificado de asistencia para la atención ya registrada.</p>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label>Hora de Inicio</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required/></div>
                            <div><label>Hora de Fin</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required/></div>
                        </div>
                        <div className="flex justify-end pt-4 gap-3">
                            <button onClick={onClose} className="btn-secondary">Cancelar</button>
                            <button onClick={handleGenerateCertificate} className="btn-primary flex items-center gap-2"><Download size={18}/> Generar PDF</button>
                        </div>
                    </div>
                );

            case 'form':
            default:
                 return (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isRepresentativeAttention && (
                            !data ? <LoadingSpinner /> : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 border rounded-md">
                                    <div><label>Estudiante Representado</label>
                                        <select value={selectedStudentId || ''} onChange={e => {setSelectedStudentId(Number(e.target.value)); setSelectedCaseId(null);}} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required disabled={!!appointment?.studentId}>
                                            <option value="">Seleccione...</option>
                                            {data.students.map(s => <option key={s.id} value={s.id!}>{s.fullName}</option>)}
                                        </select>
                                    </div>
                                    <div><label>Asociar al Caso</label>
                                        <select value={selectedCaseId || ''} onChange={e => setSelectedCaseId(Number(e.target.value))} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" disabled={!selectedStudentId || !!appointment?.caseId}>
                                            <option value="">Seleccione...</option>
                                            {studentCases.map(c => <option key={c.id} value={c.id!}>{`${c.code} - ${c.category}`}</option>)}
                                        </select>
                                        {!selectedCaseId && selectedStudentId && studentCases.length === 0 && (
                                            <p className="text-xs text-red-500 mt-1">Este estudiante no tiene casos activos.</p>
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                        <div><label>Descripción de la Atención</label><textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required placeholder="Detalle de la conversación, acuerdos, etc." /></div>
                        <div><label>Observaciones (Internas)</label><textarea value={observations} onChange={e => setObservations(e.target.value)} rows={2} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                        {isRepresentativeAttention && (
                             <div className="grid grid-cols-2 gap-4">
                                <div><label>Hora de Inicio</label><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required/></div>
                                <div><label>Hora de Fin</label><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required/></div>
                            </div>
                        )}
                        <div className="flex justify-end pt-4 gap-3 border-t dark:border-gray-700">
                            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                            <button type="submit" className="btn-primary">Guardar Atención</button>
                        </div>
                    </form>
                );
        }
    }

    const title = appointment?.status === 'Realizada' ? "Generar Certificado de Asistencia" : "Registrar Atención";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} size="xl">
            {renderContent()}
        </Modal>
    );
};

export default AttentionModal;
