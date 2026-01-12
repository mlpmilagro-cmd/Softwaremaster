
import React, { useState, FC } from 'react';
import { db } from '../../database';
import type { PreventiveActivity } from '../../database';
import Modal from '../shared/Modal';

interface ParticipantsCountModalProps {
    isOpen: boolean;
    onClose: () => void;
    activity: PreventiveActivity;
}

const ParticipantsCountModal: FC<ParticipantsCountModalProps> = ({isOpen, onClose, activity}) => {
    const [counts, setCounts] = useState({
        attendeesMale: activity.attendeesMale || 0,
        attendeesFemale: activity.attendeesFemale || 0,
        attendeesParents: activity.attendeesParents || 0,
        attendeesTeachers: activity.attendeesTeachers || 0,
        attendeesDirectors: activity.attendeesDirectors || 0,
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCounts(prev => ({...prev, [e.target.name]: Number(e.target.value)}));
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await db.preventiveActivities.update(activity.id!, { ...counts, isExecuted: true });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Registrar Asistentes">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p className="font-semibold text-lg">{activity.topic}</p>
                <div className="grid grid-cols-2 gap-4">
                    <div><label>Estudiantes (Hombres)</label><input type="number" name="attendeesMale" value={counts.attendeesMale} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" min="0" /></div>
                    <div><label>Estudiantes (Mujeres)</label><input type="number" name="attendeesFemale" value={counts.attendeesFemale} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" min="0" /></div>
                    <div><label>Padres de Familia</label><input type="number" name="attendeesParents" value={counts.attendeesParents} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" min="0" /></div>
                    <div><label>Docentes</label><input type="number" name="attendeesTeachers" value={counts.attendeesTeachers} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" min="0" /></div>
                    <div className="col-span-2"><label>Directivos</label><input type="number" name="attendeesDirectors" value={counts.attendeesDirectors} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" min="0" /></div>
                </div>
                <div className="flex justify-end pt-4 gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Guardar y Marcar como Ejecutada</button></div>
            </form>
        </Modal>
    );
};

export default ParticipantsCountModal;
