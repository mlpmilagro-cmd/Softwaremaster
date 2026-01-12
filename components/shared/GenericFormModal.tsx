import React, { useState, useEffect, FC } from 'react';
import Modal from './Modal';

interface Field {
    name: string;
    label: string;
    type: string;
    required?: boolean;
    options?: { value: string; label: string }[];
    dependsOn?: string;
    validation?: {
        regex: string;
        errorMessage: string;
    };
}

interface GenericFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
    itemToEdit: any | null;
    dbTable: any;
    title: string;
    fields: Field[];
    numberFields?: string[];
}

const GenericFormModal: FC<GenericFormModalProps> = ({ isOpen, onClose, onSave, itemToEdit, dbTable, title, fields, numberFields }) => {
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        // When the modal opens, initialize form data.
        if (isOpen) {
            if (itemToEdit) {
                // If editing, use the existing item's data.
                setFormData(itemToEdit);
            } else {
                // If creating a new item, initialize with default values.
                // This is crucial for checkboxes to ensure they have a `false` value
                // instead of `undefined` if they are not touched.
                const initialData: { [key: string]: any } = {};
                fields.forEach(field => {
                    if (field.type === 'checkbox') {
                        initialData[field.name] = false;
                    }
                });
                setFormData(initialData);
            }
        }
    }, [itemToEdit, isOpen, fields]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const isCheckbox = type === 'checkbox';
        const { checked } = e.target as HTMLInputElement;

        const newFormData = {
            ...formData,
            [name]: isCheckbox ? checked : value
        };

        const isNowFalsey = isCheckbox ? !checked : !value;
        if (isNowFalsey) {
            fields.forEach(field => {
                if (field.dependsOn === name) {
                    newFormData[field.name] = undefined;
                }
            });
        }

        setFormData(newFormData);
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        for (const field of fields) {
            if (field.required && !formData[field.name]) {
                alert(`El campo "${field.label}" es obligatorio.`);
                return;
            }
            if (field.validation && formData[field.name]) {
                const regex = new RegExp(field.validation.regex);
                if (!regex.test(formData[field.name])) {
                    alert(field.validation.errorMessage);
                    return;
                }
            }
        }
        try {
            const dataToSave = { ...formData };
            if (numberFields) {
                for (const fieldName of numberFields) {
                    if (dataToSave[fieldName] != null && dataToSave[fieldName] !== '') {
                        dataToSave[fieldName] = Number(dataToSave[fieldName]);
                    } else {
                        delete dataToSave[fieldName];
                    }
                }
            }

            if (itemToEdit) { await dbTable.update(itemToEdit.id, dataToSave); } 
            else { await dbTable.add(dataToSave); }
            onSave();
            onClose();
        } catch (error) {
            console.error(`Error saving ${title}:`, error);
            alert(`Error al guardar: ${error}`);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={itemToEdit ? `Editar ${title}` : `Agregar ${title}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fields.map(field => {
                        const isDisabled = field.dependsOn ? !formData[field.dependsOn] : false;
                        return (
                            <div key={field.name} className={`${fields.length % 2 !== 0 && fields.indexOf(field) === fields.length -1 ? 'sm:col-span-2' : ''} ${field.type === 'checkbox' ? 'flex items-center gap-x-2' : ''}`}>
                                <label className={field.type === 'checkbox' ? 'order-2' : ''}>{field.label}</label>
                                {field.type === 'checkbox' ? (
                                    <input type="checkbox" name={field.name} checked={!!formData[field.name]} onChange={handleChange} className="order-1 h-5 w-5 rounded border-gray-300 text-dece-blue-600 focus:ring-dece-blue-500" />
                                ) : field.type === 'select' ? (
                                    <select name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-600" required={field.required} disabled={isDisabled}>
                                        <option value="">Seleccione...</option>
                                        {field.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                    </select>
                                ) : (
                                    <input type={field.type} name={field.name} value={formData[field.name] || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-600" required={field.required} disabled={isDisabled} />
                                )}
                            </div>
                        )
                    })}
                </div>
                <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                    <button type="submit" className="px-4 py-2 rounded bg-dece-blue-600 text-white hover:bg-dece-blue-700 font-semibold">Guardar</button>
                </div>
            </form>
        </Modal>
    );
};

export default GenericFormModal;