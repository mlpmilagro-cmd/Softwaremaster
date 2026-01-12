import React, { useState, useEffect, FC, useMemo } from 'react';
import { db } from '../../database';
import type { PregnancyCase, Student, CaseFile } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../shared/Modal';
import { Utils, DateUtils } from '../../utils/helpers';

interface PregnancyCaseFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemToEdit: Partial<PregnancyCase> | null;
    students: Student[];
    allCases: CaseFile[];
    onSaveAndContinue?: (data: { studentId: number; reason: string }) => void;
}

const PregnancyCaseFormModal: FC<PregnancyCaseFormModalProps> = ({ isOpen, onClose, itemToEdit, students, allCases, onSaveAndContinue }) => {
    const [formData, setFormData] = useState<Partial<PregnancyCase>>({});
    const [docName, setDocName] = useState<string | null>(null);
    const leaveSettings = useLiveQuery(() => db.settings.get('leaveSettings'));

    const {
        estimatedDueDate,
        maternityLeaveEndDate,
        lactationLeaveEndDate,
    } = useMemo(() => {
        const adjustDate = (dateString?: string): Date | null => {
            if (!dateString) return null;
            const date = new Date(dateString);
            // The input 'YYYY-MM-DD' is parsed as UTC midnight.
            // To treat it as local midnight, add the timezone offset.
            return new Date(date.getTime() + date.getTimezoneOffset() * 60000);
        };
    
        let estDueDate = '';
        const adjustedPregnancyStartDate = adjustDate(formData.pregnancyStartDate);
        if (adjustedPregnancyStartDate) {
            estDueDate = DateUtils.formatDateForInput(DateUtils.addDays(adjustedPregnancyStartDate, 280));
        }
    
        let matLeaveEndDate = '';
        const adjustedMaternityStartDate = adjustDate(formData.maternityLeaveStartDate);
        const maternitySettings = leaveSettings?.value?.maternity || { value: 90, unit: 'days' };
        if (adjustedMaternityStartDate) {
            const { value, unit } = maternitySettings;
            let endDate;
            if (unit === 'days') endDate = DateUtils.addDays(adjustedMaternityStartDate, value);
            else if (unit === 'weeks') endDate = DateUtils.addDays(adjustedMaternityStartDate, value * 7);
            else endDate = DateUtils.addMonths(adjustedMaternityStartDate, value);
            matLeaveEndDate = DateUtils.formatDateForInput(endDate);
        }
    
        let lacLeaveEndDate = '';
        const adjustedLactationStartDate = adjustDate(formData.lactationLeaveStartDate);
        const lactationSettings = leaveSettings?.value?.lactation || { value: 12, unit: 'months' };
        if (adjustedLactationStartDate) {
            const { value, unit } = lactationSettings;
            let endDate;
            if (unit === 'years') endDate = DateUtils.addYears(adjustedLactationStartDate, value);
            else endDate = DateUtils.addMonths(adjustedLactationStartDate, value);
            lacLeaveEndDate = DateUtils.formatDateForInput(endDate);
        }
    
        return { estimatedDueDate: estDueDate, maternityLeaveEndDate: matLeaveEndDate, lactationLeaveEndDate: lacLeaveEndDate };
    }, [formData.pregnancyStartDate, formData.maternityLeaveStartDate, formData.lactationLeaveStartDate, leaveSettings]);


    useEffect(() => {
        const defaultData: Partial<PregnancyCase> = {
            isFromViolence: false,
            isHighRisk: false,
            needsAlternativeEducation: false,
            receivesHealthCare: 'Ninguna',
        };
        if (itemToEdit) {
            setFormData({ ...defaultData, ...itemToEdit });
            setDocName(itemToEdit.birthCertificateBase64 ? 'Documento cargado' : null);
        } else {
            setFormData(defaultData);
            setDocName(null);
        }
    }, [itemToEdit, isOpen]);

    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            estimatedDueDate: estimatedDueDate,
            maternityLeaveEndDate: maternityLeaveEndDate,
            lactationLeaveEndDate: lactationLeaveEndDate,
        }));
    }, [estimatedDueDate, maternityLeaveEndDate, lactationLeaveEndDate]);

    const studentCases = useMemo(() => {
        if (!formData.studentId) return [];
        return allCases.filter(c => c.studentId === formData.studentId);
    }, [formData.studentId, allCases]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            const newFormData = { ...formData, [name]: checked };

            if (name === 'isHighRisk' || name === 'needsAlternativeEducation') {
                const isOtherChecked = name === 'isHighRisk' ? !!newFormData.needsAlternativeEducation : !!newFormData.isHighRisk;
                if (!checked && !isOtherChecked) {
                    delete newFormData.alternativeEducationType;
                    delete newFormData.flexibilityDetails;
                }
            }
            setFormData(newFormData);

        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };
    
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const { base64 } = await Utils.fileToBase64(file);
            setFormData(prev => ({ ...prev, birthCertificateBase64: base64 }));
            setDocName(file.name);
        }
    };

    const handleStudentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const studentId = Number(e.target.value);
        setFormData(prev => ({
            ...prev,
            studentId: studentId,
            relatedCaseId: undefined,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.studentId || !formData.pregnancyStartDate) {
            alert('Por favor, complete el estudiante y la fecha de inicio del embarazo.');
            return;
        }

        const finalData = { ...formData };

        try {
            if (itemToEdit?.id) {
                await db.pregnancyCases.update(itemToEdit.id, finalData);
                onClose();
            } else {
                const newId = await db.pregnancyCases.add(finalData as PregnancyCase);
                if (finalData.alternativeEducationType === 'assisted' && onSaveAndContinue) {
                    onSaveAndContinue({
                        studentId: finalData.studentId!,
                        reason: `Derivación por embarazo/maternidad (Registro ID: ${newId})`
                    });
                } else {
                    onClose();
                }
            }
        } catch (error) {
            console.error("Error saving pregnancy case:", error);
            alert(`Error al guardar el registro: ${error}`);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={itemToEdit?.id ? "Editar Registro" : "Nuevo Registro de Embarazo/Maternidad"} size="2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Section 1: Student and Pregnancy Details */}
                <fieldset className="p-3 border rounded-md">
                    <legend className="px-2 font-semibold text-sm">Datos del Caso y Gestación</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                            <label>Estudiante</label>
                            <select name="studentId" value={formData.studentId || ''} onChange={handleStudentChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-600" required disabled={!!itemToEdit?.studentId}>
                                <option value="">Seleccione...</option>
                                {students.map(s => <option key={s.id} value={s.id!}>{s.fullName}</option>)}
                            </select>
                        </div>
                        <div>
                            <label>Fecha de Inicio de Embarazo</label>
                            <input type="date" name="pregnancyStartDate" value={formData.pregnancyStartDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                        </div>
                        <div>
                            <label>Fecha Estimada de Parto (F.P.P)</label>
                            <input type="date" value={formData.estimatedDueDate || ''} className="mt-1 w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 dark:border-gray-600" readOnly />
                        </div>
                        <div>
                            <label>Institución de Salud</label>
                            <input type="text" name="healthInstitution" value={formData.healthInstitution || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div>
                            <label>Profesional de Salud</label>
                            <input type="text" name="healthProfessional" value={formData.healthProfessional || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div className="sm:col-span-2">
                            <label>Atención de Salud</label>
                            <select name="receivesHealthCare" value={formData.receivesHealthCare || 'Ninguna'} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                <option value="Pública">Pública</option>
                                <option value="Privada">Privada</option>
                                <option value="Ninguna">Ninguna</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2 space-y-2">
                            <label className="flex items-center gap-2"><input type="checkbox" name="isHighRisk" checked={!!formData.isHighRisk} onChange={handleChange} /><span>Estado gestacional de riesgo</span></label>
                            <label className="flex items-center gap-2"><input type="checkbox" name="needsAlternativeEducation" checked={!!formData.needsAlternativeEducation} onChange={handleChange} /><span>Necesita propuestas alternativas de educación</span></label>
                            <label className="flex items-center gap-2"><input type="checkbox" name="isFromViolence" checked={!!formData.isFromViolence} onChange={handleChange} /><span>Es producto de violencia</span></label>
                        </div>
                        {(formData.isHighRisk || formData.needsAlternativeEducation) && (
                            <div className="sm:col-span-2 p-3 border rounded-md bg-gray-50 dark:bg-gray-700/50">
                                <h4 className="font-semibold text-sm mb-2">Plan de Educación Alternativa</h4>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2">
                                        <input type="radio" name="alternativeEducationType" value="assisted" checked={formData.alternativeEducationType === 'assisted'} onChange={handleChange} />
                                        <span>Clases Asistidas</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input type="radio" name="alternativeEducationType" value="flexible" checked={formData.alternativeEducationType === 'flexible'} onChange={handleChange} />
                                        <span>Flexibilidad Horaria</span>
                                    </label>
                                </div>
                                {formData.alternativeEducationType === 'flexible' && (
                                    <div className="mt-2">
                                        <label>Detalle de la flexibilización horaria:</label>
                                        <textarea name="flexibilityDetails" value={formData.flexibilityDetails || ''} onChange={handleChange} rows={2} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </fieldset>

                {/* Section 2: Birth and Post-Partum Details */}
                <fieldset className="p-3 border rounded-md">
                    <legend className="px-2 font-semibold text-sm">Datos de Nacimiento y Permisos</legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label>Fecha de Nacimiento</label>
                            <input type="date" name="birthDate" value={formData.birthDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                        </div>
                        <div className="sm:col-span-2"><hr className="dark:border-gray-600 my-2" /></div>
                        
                        <div className={`${!formData.birthDate ? 'opacity-50' : ''}`}>
                            <label>Inicio Permiso Maternidad</label>
                            <input type="date" name="maternityLeaveStartDate" value={formData.maternityLeaveStartDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" disabled={!formData.birthDate}/>
                        </div>
                        <div className={`${!formData.birthDate ? 'opacity-50' : ''}`}>
                            <label>Fin Permiso Maternidad</label>
                            <input type="date" value={formData.maternityLeaveEndDate || ''} className="mt-1 w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 dark:border-gray-600" readOnly disabled={!formData.birthDate}/>
                        </div>

                        <div className={`${!formData.birthDate ? 'opacity-50' : ''}`}>
                            <label>Inicio Permiso Lactancia</label>
                            <input type="date" name="lactationLeaveStartDate" value={formData.lactationLeaveStartDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" disabled={!formData.birthDate}/>
                        </div>
                        <div className={`${!formData.birthDate ? 'opacity-50' : ''}`}>
                            <label>Fin Permiso Lactancia</label>
                            <input type="date" value={formData.lactationLeaveEndDate || ''} className="mt-1 w-full p-2 border rounded bg-gray-100 dark:bg-gray-800 dark:border-gray-600" readOnly disabled={!formData.birthDate}/>
                        </div>
                        <div className={`sm:col-span-2 ${!formData.birthDate ? 'opacity-50' : ''}`}>
                            <label>Acta de Nacido Vivo</label>
                             <div className="flex items-center mt-1">
                                <label className="cursor-pointer bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-l-md text-sm hover:bg-gray-300 dark:hover:bg-gray-500">
                                    <input type="file" name="birthCertificateBase64" className="hidden" onChange={handleFileChange} disabled={!formData.birthDate} />
                                    Adjuntar
                                </label>
                                <span className="p-2 border border-l-0 rounded-r-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm truncate w-full">
                                    {docName || 'Ningún archivo seleccionado'}
                                </span>
                            </div>
                        </div>
                    </div>
                </fieldset>

                <div>
                    <label>Expediente de Caso Asociado (Opcional)</label>
                    <select name="relatedCaseId" value={formData.relatedCaseId || ''} onChange={(e) => setFormData(p => ({...p, relatedCaseId: e.target.value ? Number(e.target.value) : undefined}))} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-600" disabled={!formData.studentId || !!itemToEdit?.relatedCaseId}>
                        <option value="">Ninguno</option>
                        {studentCases.map(c => <option key={c.id} value={c.id!}>{`${c.code} - ${c.category}`}</option>)}
                    </select>
                </div>

                <div className="flex justify-end pt-4 gap-3 border-t dark:border-gray-700">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button type="submit" className="btn-primary">Guardar Registro</button>
                </div>
            </form>
        </Modal>
    );
};

export default PregnancyCaseFormModal;