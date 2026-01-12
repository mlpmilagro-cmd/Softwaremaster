
import React, { useState, FC } from 'react';
import { db } from '../../database';
import type { PreventiveActivity } from '../../database';
import Modal from '../shared/Modal';

const ActivityModal: FC<{isOpen: boolean, onClose: ()=>void, selectedDate: Date, activity?: PreventiveActivity}> = ({isOpen, onClose, selectedDate, activity}) => {
    const [formData, setFormData] = useState<Partial<PreventiveActivity>>(() => activity || {
        date: selectedDate.toISOString().split('T')[0],
        endDate: selectedDate.toISOString().split('T')[0],
        // FIX: Ensure audience is initialized as an array to prevent spreading undefined.
        audience: [],
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if ((name === 'date' || name === 'endDate') && value) {
            const date = new Date(value);
            // new Date('YYYY-MM-DD') is UTC midnight. getDay() is local time. To be safe, use getUTCDay()
            const day = date.getUTCDay();
            if (day === 6 || day === 0) { // Saturday or Sunday
                alert('No se pueden planificar actividades en fines de semana.');
                return;
            }
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation for end date
        if (formData.date && formData.endDate && new Date(formData.endDate) < new Date(formData.date)) {
            alert("La fecha de fin no puede ser anterior a la fecha de inicio.");
            return;
        }

        try {
            if (activity?.id) {
                await db.preventiveActivities.update(activity.id, formData);
            } else {
                await db.preventiveActivities.add({ ...formData, isExecuted: false, attendeesMale: 0, attendeesFemale: 0, audience: formData.audience || [] } as PreventiveActivity);
            }
            onClose();
        } catch(error) {
            console.error(error);
            alert('Error al guardar la actividad');
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={activity ? "Editar Actividad" : "Planificar Actividad"}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label>Título</label><input type="text" name="topic" value={formData.topic || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                <div><label>Descripción</label><textarea name="description" value={formData.description || ''} onChange={handleChange} rows={3} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"></textarea></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label>Fecha de Inicio</label><input type="date" name="date" value={formData.date || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                    <div><label>Fecha de Fin</label><input type="date" name="endDate" value={formData.endDate || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required /></div>
                </div>
                <div className="flex justify-end pt-4 gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Guardar</button></div>
            </form>
        </Modal>
    );
};

export default ActivityModal;