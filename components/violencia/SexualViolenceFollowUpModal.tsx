import React, { useState, useEffect, FC } from 'react';
import type Dexie from 'dexie';
import { db } from '../../database';
import type { CaseFile, FollowUp, DeceFollowUpForm, Student } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../shared/Modal';
import LoadingSpinner from '../shared/LoadingSpinner';
import { Utils, DateUtils } from '../../utils/helpers';
import { DECE_FORM_QUESTIONS } from '../../utils/constants';
import { Upload, Download, FileX, Archive, MoveRight, FileText } from 'lucide-react';
import { PdfGenerator } from '../../utils/pdf';

type CaseWithDetails = CaseFile & { student?: Student };

const SexualViolenceFollowUpModal: FC<{ isOpen: boolean; onClose: () => void; caseFile: CaseWithDetails }> = ({ isOpen, onClose, caseFile }) => {
    const [activeTab, setActiveTab] = useState('seguimientos');
    const [caseData, setCaseData] = useState<CaseWithDetails>(caseFile);
    
    const followUps = useLiveQuery(() => db.followUps.where({ caseId: caseFile.id! }).sortBy('date'), [caseFile.id]);
    const [deceFormData, setDeceFormData] = useState<Partial<DeceFollowUpForm>>({});
    const [isDeceFormSubmitted, setIsDeceFormSubmitted] = useState(false);
    const [newFollowUp, setNewFollowUp] = useState<Partial<FollowUp>>({ date: new Date().toISOString().split('T')[0], isEffective: true });

    // State for new modals
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
    const [transferReason, setTransferReason] = useState('');
    const [closeReason, setCloseReason] = useState('');
    
    useEffect(() => {
        const loadInitialData = async () => {
            // Re-fetch details when modal opens to ensure data is fresh
            const details = await db.sexualViolenceCaseDetails.where({ caseFileId: caseFile.id! }).first();
            const fullCaseData = { ...caseFile, details };
            setCaseData(fullCaseData);

            const latest = await db.deceFollowUpForms.where({caseFileId: caseFile.id!}).first();
            if (latest) {
                setDeceFormData(latest);
                setIsDeceFormSubmitted(true);
            } else {
                setDeceFormData({});
                setIsDeceFormSubmitted(false);
            }
        };
        if (isOpen) {
            loadInitialData();
        }
    }, [caseFile, isOpen]);
    
    const handlePlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const { base64 } = await Utils.fileToBase64(file);

            await (db as Dexie).transaction('rw', db.caseFiles, db.followUps, async () => {
                await db.caseFiles.update(caseFile.id!, { accompanimentPlanBase64: base64 });
                await db.followUps.add({
                    caseId: caseFile.id!,
                    date: new Date().toISOString().split('T')[0],
                    description: "Plan de Acompañamiento cargado en el sistema.",
                    responsible: "Sistema", // Or current user name
                    isEffective: false
                });
            });
            setCaseData(prev => ({...prev, accompanimentPlanBase64: base64}));
        }
    };

    const handleDownloadPlan = () => {
        if (!caseData.accompanimentPlanBase64) return;
        const link = document.createElement('a');
        link.href = caseData.accompanimentPlanBase64;
        link.download = `Plan_Acompañamiento_${caseFile.code}.pdf`; // Assuming PDF or image
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleSaveDeceForm = async () => {
        const followUpId = await db.followUps.add({
            caseId: caseFile.id!,
            date: new Date().toISOString().split('T')[0],
            description: "Formulario DECE inicial completado.",
            responsible: "Sistema",
            isEffective: false
        });

        await db.deceFollowUpForms.add({
            ...deceFormData,
            caseFileId: caseFile.id!,
            followUpId: followUpId,
        } as DeceFollowUpForm);

        setIsDeceFormSubmitted(true);
        alert("Formulario DECE guardado con éxito.");
    };

    const handleAddFollowUp = async () => {
        if (!newFollowUp.description || !newFollowUp.responsible) {
            alert("Por favor complete la descripción y el responsable.");
            return;
        }
        const newDate = new Date(newFollowUp.date!);
        const nextDueDate = DateUtils.formatDateForInput(DateUtils.addDays(newDate, 75)); // Approx 2.5 months
        
        await db.followUps.add({
            ...newFollowUp,
            caseId: caseFile.id!,
        } as FollowUp);

        await db.caseFiles.update(caseFile.id!, { dueDate: nextDueDate });
        
        setNewFollowUp({ date: new Date().toISOString().split('T')[0], isEffective: true });
        alert("Seguimiento guardado.");
    };
    
    const handleConfirmClose = async () => {
        if (!closeReason) {
            alert("Por favor, ingrese un motivo para cerrar el caso.");
            return;
        }
        await (db as Dexie).transaction('rw', db.followUps, db.caseFiles, async () => {
            await db.followUps.add({
                caseId: caseData.id!,
                date: new Date().toISOString().split('T')[0],
                description: `Caso cerrado. Motivo: ${closeReason}`,
                responsible: 'Sistema',
                isEffective: false,
            });
            await db.caseFiles.update(caseData.id!, { status: 'Cerrado' });
        });
        setCaseData(prev => ({ ...prev, status: 'Cerrado' }));
        setIsCloseModalOpen(false);
        setCloseReason('');
    };
    
    const handleConfirmTransfer = async () => {
        if (!transferReason) {
            alert("Por favor, ingrese el nombre de la institución.");
            return;
        }
        await (db as Dexie).transaction('rw', db.followUps, db.caseFiles, async () => {
            await db.followUps.add({
                caseId: caseData.id!,
                date: new Date().toISOString().split('T')[0],
                description: `Estudiante trasladado a la IE: ${transferReason}`,
                responsible: 'Sistema',
                isEffective: false,
            });
            await db.caseFiles.update(caseData.id!, { status: 'Cerrado' });
        });
        setCaseData(prev => ({ ...prev, status: 'Cerrado' }));
        setIsTransferModalOpen(false);
        setTransferReason('');
    };

    const handleDownloadHistory = async () => {
        if (caseFile.student && followUps) {
            await PdfGenerator.generateFollowUpHistoryPdf(caseFile, caseFile.student, followUps);
        }
    };

    const handleGenerateDecePdf = () => {
        PdfGenerator.generateDeceFormPdf(caseFile.id!);
    };

    if (!caseData) return <LoadingSpinner />;

    if (!caseData.accompanimentPlanBase64) {
        return (
            <Modal isOpen={isOpen} onClose={onClose} title="Plan de Acompañamiento Requerido">
                <div className="text-center p-4">
                    <p className="mb-4">Para registrar seguimientos, primero debe cargar el Plan de Acompañamiento aprobado.</p>
                    <label className="btn-primary flex items-center justify-center gap-2 cursor-pointer">
                        <Upload size={18} />
                        <input type="file" className="hidden" accept=".pdf,image/*" onChange={handlePlanUpload} />
                        Subir Plan
                    </label>
                </div>
            </Modal>
        );
    }
    
    const isClosed = caseData.status === 'Cerrado';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Seguimiento Caso: ${caseFile.code}`} size="2xl">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-4 p-2 border-b gap-2">
                <div className="flex border-b sm:border-b-0">
                    <button onClick={() => setActiveTab('seguimientos')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'seguimientos' ? 'border-b-2 border-dece-blue-500 text-dece-blue-600' : 'text-gray-500'}`}>Seguimientos Trimestrales</button>
                    <button onClick={() => setActiveTab('dece')} className={`py-2 px-4 text-sm font-medium ${activeTab === 'dece' ? 'border-b-2 border-dece-blue-500 text-dece-blue-600' : 'text-gray-500'}`}>Formulario DECE</button>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                    <button onClick={handleDownloadPlan} className="btn-secondary text-sm flex items-center gap-1"><Download size={16}/>Descargar Plan</button>
                    <button onClick={() => setIsTransferModalOpen(true)} disabled={isClosed} className="btn-secondary text-sm flex items-center gap-1"><MoveRight size={16}/>Registrar Traslado</button>
                    <button onClick={() => setIsCloseModalOpen(true)} disabled={isClosed} className="btn-danger text-sm flex items-center gap-1"><Archive size={16}/>Cerrar Caso</button>
                </div>
            </div>

            {isClosed && (
                <div className="text-center p-8 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <h3 className="text-xl font-bold text-green-700 dark:text-green-300">Caso Cerrado</h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">Este caso ha sido cerrado y ya no se pueden registrar nuevos seguimientos.</p>
                </div>
            )}
            
            {!isClosed && (
                <div className="max-h-[60vh] overflow-y-auto p-1">
                    {activeTab === 'seguimientos' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold">Historial de Seguimientos</h3>
                                <button onClick={handleDownloadHistory} className="btn-secondary text-sm flex items-center gap-1"><FileText size={16}/>Descargar Historial</button>
                            </div>
                            <div className="space-y-2 max-h-40 overflow-y-auto border p-2 rounded-md dark:border-gray-600">
                                {followUps?.map(f => <div key={f.id} className="text-sm">{Utils.formatDate(f.date)}: {f.description}</div>)}
                                {!followUps || followUps.length === 0 && <p className="text-sm text-gray-500">No hay seguimientos.</p>}
                            </div>
                            <h3 className="font-semibold pt-2 border-t dark:border-gray-700">Nuevo Seguimiento Periódico</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input type="date" value={newFollowUp.date || ''} onChange={e => setNewFollowUp(p => ({...p, date: e.target.value}))} className="p-2 border rounded dark:bg-gray-700" />
                                <input value={newFollowUp.responsible || ''} onChange={e => setNewFollowUp(p => ({...p, responsible: e.target.value}))} placeholder="Responsable" className="p-2 border rounded dark:bg-gray-700" />
                                <textarea value={newFollowUp.description || ''} onChange={e => setNewFollowUp(p => ({...p, description: e.target.value}))} placeholder="Descripción del seguimiento..." rows={3} className="sm:col-span-2 p-2 border rounded dark:bg-gray-700"></textarea>
                                <div className="sm:col-span-2 flex items-center gap-2">
                                    <input type="checkbox" name="isEffective" id="isEffectiveFollowUp" checked={newFollowUp.isEffective ?? true} onChange={(e) => setNewFollowUp(p => ({...p, isEffective: e.target.checked}))} className="h-4 w-4 rounded border-gray-300 text-dece-blue-600 focus:ring-dece-blue-500" />
                                    <label htmlFor="isEffectiveFollowUp" className="text-sm font-medium">Atención Efectiva (contará para estadísticas)</label>
                                </div>
                            </div>
                             <div className="flex justify-end pt-2">
                                <button onClick={handleAddFollowUp} className="btn-primary">Agregar Seguimiento</button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'dece' && (
                        <div className="space-y-4">
                             <div className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700/50 mb-4 text-sm">
                                <h4 className="font-semibold mb-2 text-base">Datos del Caso</h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <p><span className="font-semibold">Víctima:</span> {caseFile.student?.fullName || 'N/A'}</p>
                                    <p><span className="font-semibold">Infractor:</span> {(caseData as any).details?.infractorFullName || 'N/A'}</p>
                                    <p><span className="font-semibold">Delito:</span> {(caseData as any).details?.crimeType || 'N/A'}</p>
                                    <p><span className="font-semibold">Relación Infractor:</span> {(caseData as any).details?.infractorRelationship || 'N/A'}</p>
                                    <p><span className="font-semibold">Fecha Incidente:</span> {(caseData as any).details?.incidentDate ? Utils.formatDate((caseData as any).details.incidentDate) : 'N/A'}</p>
                                    <p><span className="font-semibold">Fecha Denuncia:</span> {(caseData as any).details?.denunciationDate ? Utils.formatDate((caseData as any).details.denunciationDate) : 'N/A'}</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold">Formulario de Seguimiento DECE</h3>
                                {isDeceFormSubmitted && (
                                    <button onClick={handleGenerateDecePdf} className="btn-secondary text-sm flex items-center gap-1"><FileText size={16}/>Descargar Formulario PDF</button>
                                )}
                            </div>
                            {isDeceFormSubmitted && <p className="text-sm p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md">Este formulario ya fue guardado y no puede ser editado. Puede consultarlo aquí y descargarlo.</p>}
                            <div className="space-y-2">
                            {DECE_FORM_QUESTIONS.map(q => (
                                <div key={q.key} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-700/50">
                                    <label htmlFor={q.key} className="text-sm">{q.text}</label>
                                    <div className="flex gap-2">
                                        <label className="flex items-center gap-1"><input type="radio" name={q.key} checked={deceFormData[q.key as keyof DeceFollowUpForm] === true} onChange={() => setDeceFormData(p => ({...p, [q.key]: true}))} disabled={isDeceFormSubmitted}/> Sí</label>
                                        <label className="flex items-center gap-1"><input type="radio" name={q.key} checked={deceFormData[q.key as keyof DeceFollowUpForm] === false} onChange={() => setDeceFormData(p => ({...p, [q.key]: false}))} disabled={isDeceFormSubmitted}/> No</label>
                                    </div>
                                </div>
                            ))}
                            {/* Text inputs */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <input value={deceFormData.q16_monitorName || ''} onChange={e => setDeceFormData(p => ({...p, q16_monitorName: e.target.value}))} placeholder="16. Nombre del monitor" className="p-2 border rounded dark:bg-gray-700" disabled={isDeceFormSubmitted}/>
                                <input value={deceFormData.q17_monitorPosition || ''} onChange={e => setDeceFormData(p => ({...p, q17_monitorPosition: e.target.value}))} placeholder="17. Cargo del monitor" className="p-2 border rounded dark:bg-gray-700" disabled={isDeceFormSubmitted}/>
                                <input value={deceFormData.q18a_newAmie || ''} onChange={e => setDeceFormData(p => ({...p, q18a_newAmie: e.target.value}))} placeholder="18a. Nuevo AMIE (si aplica)" className="p-2 border rounded dark:bg-gray-700" disabled={!deceFormData.q18_victimChangedInstitution || isDeceFormSubmitted}/>
                                <input value={deceFormData.q18b_newInstitutionName || ''} onChange={e => setDeceFormData(p => ({...p, q18b_newInstitutionName: e.target.value}))} placeholder="18b. Nuevo Nombre IE (si aplica)" className="p-2 border rounded dark:bg-gray-700" disabled={!deceFormData.q18_victimChangedInstitution || isDeceFormSubmitted}/>
                                <input value={deceFormData.q19_psychologicalSupportProvider || ''} onChange={e => setDeceFormData(p => ({...p, q19_psychologicalSupportProvider: e.target.value}))} placeholder="19. Quién acompaña psicológicamente" className="p-2 border rounded dark:bg-gray-700" disabled={isDeceFormSubmitted}/>
                            </div>
                            <textarea value={deceFormData.observations || ''} onChange={e => setDeceFormData(p => ({...p, observations: e.target.value}))} placeholder="Observaciones Generales..." rows={3} className="w-full mt-2 p-2 border rounded dark:bg-gray-700" disabled={isDeceFormSubmitted}></textarea>
                            </div>
                             {!isDeceFormSubmitted && (
                                <div className="flex justify-end pt-2">
                                    <button onClick={handleSaveDeceForm} className="btn-primary">Guardar Formulario DECE (Solo 1 vez)</button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* Transfer Modal */}
            {isTransferModalOpen && (
                <Modal isOpen={true} onClose={() => setIsTransferModalOpen(false)} title="Registrar Traslado de Estudiante">
                    <div className="space-y-4">
                        <p>Esta acción cerrará el caso en esta institución. Se registrará un seguimiento final con la información del traslado.</p>
                        <div>
                            <label>Nombre y AMIE de la nueva Institución Educativa</label>
                            <input
                                type="text"
                                value={transferReason}
                                onChange={(e) => setTransferReason(e.target.value)}
                                className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                placeholder="Ej: U.E. Ejemplo - 09H1234"
                            />
                        </div>
                        <div className="flex justify-end pt-4 gap-3">
                            <button type="button" onClick={() => setIsTransferModalOpen(false)} className="btn-secondary">Cancelar</button>
                            <button onClick={handleConfirmTransfer} className="btn-primary">Confirmar Traslado</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Close Case Modal */}
            {isCloseModalOpen && (
                <Modal isOpen={true} onClose={() => setIsCloseModalOpen(false)} title="Cerrar Caso">
                    <div className="space-y-4">
                        <p>Esta acción cerrará el caso permanentemente. Se registrará un seguimiento final con el motivo del cierre.</p>
                        <div>
                            <label>Motivo del Cierre</label>
                            <textarea
                                value={closeReason}
                                onChange={(e) => setCloseReason(e.target.value)}
                                rows={3}
                                className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                                placeholder="Ej: Estudiante se gradúa de bachiller."
                            />
                        </div>
                        <div className="flex justify-end pt-4 gap-3">
                            <button type="button" onClick={() => setIsCloseModalOpen(false)} className="btn-secondary">Cancelar</button>
                            <button onClick={handleConfirmClose} className="btn-danger">Confirmar Cierre</button>
                        </div>
                    </div>
                </Modal>
            )}
        </Modal>
    );
};

export default SexualViolenceFollowUpModal;
