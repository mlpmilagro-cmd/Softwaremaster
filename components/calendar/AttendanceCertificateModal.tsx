import React, { useState, FC, useEffect } from 'react';
import { db } from '../../database';
import type { Appointment, Representative } from '../../database';
import Modal from '../shared/Modal';
import { PdfGenerator } from '../../utils/pdf';

interface AttendanceCertificateModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: Appointment;
}

const AttendanceCertificateModal: FC<AttendanceCertificateModalProps> = ({ isOpen, onClose, appointment }) => {
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');

    useEffect(() => {
        if (appointment) {
            setStartTime(appointment.startTime);
            
            // Calculate a default end time (e.g., 1 hour later)
            if (appointment.startTime) {
                const [h, m] = appointment.startTime.split(':').map(Number);
                const endDate = new Date();
                endDate.setHours(h + 1, m, 0, 0);
                const endH = String(endDate.getHours()).padStart(2, '0');
                const endM = String(endDate.getMinutes()).padStart(2, '0');
                setEndTime(`${endH}:${endM}`);
            }
        }
    }, [appointment]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startTime || !endTime) {
            alert("Por favor, ingrese la hora de inicio y fin.");
            return;
        }
        
        if (appointment.attendeeType !== 'Representante') {
            alert("Este certificado solo se puede generar para citas con representantes.");
            return;
        }

        const representative = await db.representatives.get(appointment.attendeeId);
        if (!representative) {
            alert("No se pudieron encontrar los datos del representante.");
            return;
        }

        // FIX: The `generateAttendanceCertificatePdf` function expects a single object argument.
        await PdfGenerator.generateAttendanceCertificatePdf({
            representativeName: representative.fullName,
            representativeCedula: representative.cedula,
            date: appointment.date,
            startTime,
            endTime
        });
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generar Certificado de Asistencia">
            <form onSubmit={handleSubmit} className="space-y-4">
                <p>Ingrese el rango de horas de la atención para generar el certificado.</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="startTime">Hora de Inicio</label>
                        <input
                            type="time"
                            id="startTime"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor="endTime">Hora de Fin</label>
                        <input
                            type="time"
                            id="endTime"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            required
                        />
                    </div>
                </div>
                <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button type="submit" className="btn-primary">Generar PDF</button>
                </div>
            </form>
        </Modal>
    );
};

export default AttendanceCertificateModal;