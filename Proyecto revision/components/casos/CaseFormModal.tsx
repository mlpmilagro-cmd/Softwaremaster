
import React, { useState, useEffect, FC } from 'react';
import { db } from '../../database';
import type { CaseFile, Student, CaseCategoryItem, Institution } from '../../database';
import Modal from '../shared/Modal';
import { Paperclip } from 'lucide-react';
import { Utils } from '../../utils/helpers';
import { CASE_PRIORITIES, CASE_STATUSES } from '../../utils/constants';

interface CaseFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseToEdit: CaseFile | null;
    students: Student[];
    categories: CaseCategoryItem[];
    onPregnancyCaseCreated?: (studentId: number, newCaseId: number) => void;
}

const CaseFormModal: FC<CaseFormModalProps> = ({ isOpen, onClose, caseToEdit, students, categories, onPregnancyCaseCreated }) => {
    const [formData, setFormData] = useState<Partial<CaseFile>>({});

    useEffect(() => {
        if (caseToEdit) {
            setFormData(caseToEdit);
        } else {
            const today = new Date().toISOString().split('T')[0];
            setFormData({
                priority: 'Media', status: 'Abierto', openingDate: today, attachments: []
            });
        }
    }, [caseToEdit, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const attachment = await Utils.fileToBase64(file);
            setFormData(prev => ({ ...prev, attachments: [...(prev.attachments || []), attachment] }));
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (caseToEdit) {
                await db.caseFiles.update(caseToEdit.id!, formData);
                onClose(); // Always close on edit
            } else {
                const institution = await db.institution.toCollection().first();
                const student = students.find(s => s.id === Number(formData.studentId));
                const getInitials = (name: string = '') => name.split(' ').map(word => word[0]).join('').toUpperCase();
                
                const institutionInitials = getInitials(institution?.name);
                const studentInitials = getInitials(student?.fullName);
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const code = `${institutionInitials || 'IE'}-${studentInitials || 'XX'}-${dateStr}-${String(Date.now()).slice(-4)}`;

                const newCaseId = await db.caseFiles.add({ ...formData, code } as CaseFile);
                
                if (formData.category === 'Embarazo/ maternidad/ paternidad adolescente' && onPregnancyCaseCreated) {
                    // Parent handles closing this modal and opening the next
                    onPregnancyCaseCreated(formData.studentId!, newCaseId);
                } else {
                    // Normal workflow, just close
                    onClose();
                }
            }
        } catch (error) {
            console.error("Error saving case:", error);
            alert(`Error al guardar: ${error}`);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={caseToEdit ? "Editar Expediente" : "Nuevo Expediente"} size="xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label>Estudiante</label><select name="studentId" value={formData.studentId || ''} onChange={(e) => setFormData(p=>({...p, studentId: Number(e.target.value)}))} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required><option value="">Seleccione...</option>{students.map(s => <option key={s.id} value={s.id!}>{s.fullName}</option>)}</select></div>
                    <div>
                        <label>Categoría</label>
                        <select name="category" value={formData.category || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required>
                            <option value="">Seleccione...</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <div><label>Prioridad</label><select name="priority" value={formData.priority || 'Media'} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">{CASE_PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
                    <div><label>Estado</label><select name="status" value={formData.status || 'Abierto'} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">{CASE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                    <div><label>Fecha de Apertura</label><input type="date" name="openingDate" value={formData.openingDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                    <div><label>Próximo Seguimiento</label><input type="date" name="dueDate" value={formData.dueDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" /></div>
                    <div className="sm:col-span-2"><label>Descripción</label><textarea name="description" value={formData.description || ''} onChange={handleChange} rows={4} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required></textarea></div>
                    <div className="sm:col-span-2"><label>Observaciones</label><textarea name="observations" value={formData.observations || ''} onChange={handleChange} rows={2} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"></textarea></div>
                     <div className="sm:col-span-2"><label>Adjuntos</label><input type="file" onChange={handleFileChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"/>
                        <div className="text-xs mt-1 space-y-1">
                            {formData.attachments?.map((att, i) => <div key={i} className="flex items-center gap-2"><Paperclip size={12}/> {att.name}</div>)}
                        </div>
                    </div>
                </div>
                 <div className="flex justify-end pt-4 gap-3"><button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button><button type="submit" className="px-4 py-2 rounded bg-dece-blue-600 text-white hover:bg-dece-blue-700 font-semibold">Guardar</button></div>
            </form>
        </Modal>
    );
};

export default CaseFormModal;
