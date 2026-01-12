import React, { useState, useEffect, FC } from 'react';
import { db } from '../../database';
import type { AssistedClass, Student } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../shared/Modal';
import { Utils } from '../../utils/helpers';

interface AssistedClassFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemToEdit: AssistedClass | null;
    initialData?: Partial<AssistedClass>;
}

const AssistedClassFormModal: FC<AssistedClassFormModalProps> = ({ isOpen, onClose, itemToEdit, initialData }) => {
    const students = useLiveQuery(() => db.students.orderBy('fullName').toArray(), []);
    const [formData, setFormData] = useState<Partial<AssistedClass>>({});
    const [docName, setDocName] = useState<string | null>(null);

    useEffect(() => {
        if (itemToEdit) {
            setFormData(itemToEdit);
            setDocName(itemToEdit.authorizationDocBase64 ? 'Documento cargado' : null);
        } else {
            setFormData(initialData || {});
            setDocName(null);
        }
    }, [itemToEdit, initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const { base64 } = await Utils.fileToBase64(file);
            setFormData(prev => ({ ...prev, authorizationDocBase64: base64 }));
            setDocName(file.name);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.studentId || !formData.reason || !formData.tentativeReturnDate) {
            alert('Por favor complete todos los campos obligatorios.');
            return;
        }
        try {
            if (itemToEdit) {
                await db.assistedClasses.update(itemToEdit.id!, formData);
            } else {
                await db.assistedClasses.add(formData as AssistedClass);
            }
            onClose();
        } catch (error) {
            console.error("Error saving assisted class:", error);
            alert(`Error al guardar: ${error}`);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={itemToEdit ? "Editar Registro" : "Nuevo Registro de Clase Asistida"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <label>Estudiante</label>
                        <select name="studentId" value={formData.studentId || ''} onChange={(e) => setFormData(p => ({ ...p, studentId: Number(e.target.value) }))} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required disabled={!!initialData?.studentId}>
                            <option value="">Seleccione...</option>
                            {students?.map(s => <option key={s.id} value={s.id!}>{s.fullName}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <label>Motivo del cambio de modalidad</label>
                        <input type="text" name="reason" value={formData.reason || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                    <div>
                        <label>Plazo de permiso</label>
                        <input type="text" name="permissionPeriod" value={formData.permissionPeriod || ''} onChange={handleChange} placeholder="Ej: 30 días" className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label>Fecha tentativa de retorno</label>
                        <input type="date" name="tentativeReturnDate" value={formData.tentativeReturnDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                    <div className="sm:col-span-2">
                        <label>Documento de autorización (imagen o PDF)</label>
                        <div className="flex items-center mt-1">
                            <label className="cursor-pointer bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-l-md text-sm hover:bg-gray-300 dark:hover:bg-gray-500">
                                <input type="file" name="authorizationDocBase64" className="hidden" onChange={handleFileChange} />
                                Adjuntar
                            </label>
                            <span className="p-2 border border-l-0 rounded-r-md bg-gray-50 dark:bg-gray-700 dark:border-gray-600 text-sm truncate w-full">
                                {docName || 'Ningún archivo seleccionado'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                    <button type="submit" className="px-4 py-2 rounded bg-dece-blue-600 text-white hover:bg-dece-blue-700 font-semibold">Guardar</button>
                </div>
            </form>
        </Modal>
    );
};

export default AssistedClassFormModal;