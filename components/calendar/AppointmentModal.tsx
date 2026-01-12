
import React, { useState, useMemo, FC } from 'react';
import { db } from '../../database';
import type { Appointment, Student, Representative, Teacher, CaseFile } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../shared/Modal';
import { Utils } from '../../utils/helpers';

interface AppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedDate: Date;
    people: {
        students: Student[];
        representatives: Representative[];
        teachers: Teacher[];
    };
    onSave: (app: Appointment) => void;
}

const AppointmentModal: FC<AppointmentModalProps> = ({isOpen, onClose, selectedDate, people, onSave}) => {
    const [formData, setFormData] = useState<Partial<Appointment>>({ date: selectedDate.toISOString().split('T')[0], attendeeType: 'Estudiante', status: 'Programada' });
    const appointmentsOnDate = useLiveQuery(() => db.appointments.where('date').equals(selectedDate.toISOString().split('T')[0]).toArray(), [selectedDate]);
    const workingHours = useLiveQuery(() => db.settings.get('workingHours'));

    const representedStudents = useLiveQuery(async () => {
        if (formData.attendeeType !== 'Representante' || !formData.attendeeId) return [];
        // Ensure attendeeId is a number for the query
        return db.students.where('representativeId').equals(Number(formData.attendeeId)).toArray();
    }, [formData.attendeeType, formData.attendeeId]);

    const studentCases = useLiveQuery(async () => {
        if (!formData.studentId) return [];
        // Ensure studentId is a number for the query
        return db.caseFiles.where('studentId').equals(Number(formData.studentId)).filter(c => c.status !== 'Cerrado').toArray();
    }, [formData.studentId]);

    const availableSlots = useMemo(() => {
        const slots: string[] = [];
        const startHour = workingHours?.value?.start ? parseInt(workingHours.value.start.split(':')[0]) : 9;
        const endHour = workingHours?.value?.end ? parseInt(workingHours.value.end.split(':')[0]) : 18;

        for (let i = startHour; i < endHour; i++) {
            if (i === 13) continue; // Lunch time
            slots.push(`${String(i).padStart(2, '0')}:00`);
            slots.push(`${String(i).padStart(2, '0')}:30`);
        }
        const bookedSlots = appointmentsOnDate?.map(a => a.startTime) || [];
        return slots.filter(s => !bookedSlots.includes(s));
    }, [appointmentsOnDate, workingHours]);
    
    const attendeeList = formData.attendeeType === 'Estudiante' ? people?.students : (formData.attendeeType === 'Representante' ? people?.representatives : people?.teachers);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        
        let newFormData = { ...formData, [name]: value };

        // Reset dependent fields when parent fields change
        if(name === 'attendeeType'){
          newFormData = { ...newFormData, attendeeId: undefined, studentId: undefined, caseId: undefined };
        }
        if(name === 'attendeeId') {
            // Convert to number immediately if it's an ID field
            newFormData = { ...newFormData, attendeeId: Number(value), studentId: undefined, caseId: undefined };
        }
        if (name === 'studentId') {
            newFormData = { ...newFormData, studentId: Number(value), caseId: undefined };
        }
        if (name === 'caseId') {
            newFormData = { ...newFormData, caseId: Number(value) };
        }

        setFormData(newFormData);
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const attendee = attendeeList?.find((p: any) => p.id === Number(formData.attendeeId));
        
        const startTime = formData.startTime || '00:00';
        const [hours, minutes] = startTime.split(':').map(Number);
        const endTime = new Date();
        endTime.setHours(hours, minutes + 30, 0, 0);

        const finalData = {
          ...formData,
          title: `Cita con ${formData.attendeeType} - ${attendee?.fullName || ''}`,
          responsibleUserId: 1, // Placeholder
          endTime: `${String(endTime.getHours()).padStart(2,'0')}:${String(endTime.getMinutes()).padStart(2,'0')}`
        } as Appointment;
        
        try {
            const id = await db.appointments.add(finalData);
            onSave({...finalData, id});
        } catch (error) {
            console.error(error);
            alert('Error al guardar la cita.');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Agendar Cita para ${Utils.formatDate(selectedDate)}`} size="lg">
             <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label>Hora Disponible</label>
                        <select name="startTime" value={formData.startTime || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required>
                            <option value="">Seleccione...</option>
                            {availableSlots.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label>Tipo de Participante</label>
                        <select name="attendeeType" value={formData.attendeeType} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                            <option value="Estudiante">Estudiante</option>
                            <option value="Representante">Representante</option>
                            <option value="Docente">Docente</option>
                        </select>
                    </div>
                    <div className="sm:col-span-2">
                        <label>Participante</label>
                        <select name="attendeeId" value={formData.attendeeId || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required>
                             <option value="">Seleccione...</option>
                             {attendeeList?.map((p: any) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                        </select>
                    </div>

                    {formData.attendeeType === 'Representante' && formData.attendeeId && (
                        <>
                            <div>
                                <label>Estudiante Relacionado</label>
                                <select name="studentId" value={formData.studentId || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required>
                                    <option value="">Seleccione...</option>
                                    {representedStudents?.map(s => <option key={s.id} value={s.id!}>{s.fullName}</option>)}
                                </select>
                            </div>
                             <div>
                                <label>Caso Relacionado (Opcional)</label>
                                <select name="caseId" value={formData.caseId || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" disabled={!formData.studentId}>
                                    <option value="">Ninguno</option>
                                    {studentCases?.map(c => <option key={c.id} value={c.id!}>{`${c.code} - ${c.category}`}</option>)}
                                </select>
                            </div>
                        </>
                    )}

                    <div>
                        <label>Tipo de Cita</label>
                        <input type="text" name="type" value={formData.type || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" placeholder="Ej: Entrevista, Seguimiento" />
                    </div>
                    <div>
                        <label>Motivo</label>
                        <input type="text" name="reason" value={formData.reason || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required/>
                    </div>
                </div>
                <div className="flex justify-end pt-4 gap-3"><button type="button" onClick={onClose} className="btn-secondary">Cancelar</button><button type="submit" className="btn-primary">Guardar Cita</button></div>
             </form>
        </Modal>
    );
};

export default AppointmentModal;
