
import React, { useState, FC } from 'react';
import { db } from '../../database';
import type { Appointment, PreventiveActivity, CaseFile, User } from '../../database';
import Modal from '../shared/Modal';
import { Utils } from '../../utils/helpers';
import { PdfGenerator } from '../../utils/pdf';
import ActivityModal from './ActivityModal';
import ParticipantsCountModal from './ParticipantsCountModal';
import { MessageSquare } from 'lucide-react';
import AttentionModal from '../shared/AttentionModal';

// Define a discriminated union for more type-safe event handling
type CalendarEvent =
    | { type: 'appointment'; data: Appointment }
    | { type: 'activity'; data: PreventiveActivity }
    | { type: 'followup'; data: CaseFile & { studentName?: string } };

interface EventDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: CalendarEvent | null; // Allow null to handle edge cases
    currentUser: User;
}

const EventDetailModal: FC<EventDetailModalProps> = ({isOpen, onClose, event, currentUser}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isConfirmingDelete, setConfirmingDelete] = useState(false);
    const [isParticipantsModalOpen, setParticipantsModalOpen] = useState(false);
    const [isAttentionModalOpen, setIsAttentionModalOpen] = useState(false);
    
    if (!event) {
        return null;
    }

    const isPast = new Date(event.type === 'followup' ? event.data.dueDate : event.data.date) < new Date();

    const handleDelete = async () => {
        try {
            if(event.type === 'appointment') await db.appointments.delete(event.data.id!);
            else if (event.type === 'activity') await db.preventiveActivities.delete(event.data.id!);
            // Follow-ups are not deleted from here
            onClose();
        } catch(e) { alert("Error al eliminar"); }
    };

    const handleMarkAsExecuted = () => {
        setParticipantsModalOpen(true);
    };

    const handleNotifyWhatsApp = async () => {
        if (event.type !== 'appointment' || event.data.attendeeType !== 'Representante') {
            alert('Solo se puede notificar citas de representantes.');
            return;
        }

        try {
            const appointment = event.data;
            const representative = await db.representatives.get(appointment.attendeeId);
            if (!representative || !representative.phone) {
                alert('El representante no tiene un número de teléfono registrado.');
                return;
            }

            // Format phone number
            let phoneNumber = representative.phone.trim();
            if (phoneNumber.startsWith('0')) {
                phoneNumber = phoneNumber.substring(1);
            }
            const fullPhoneNumber = `593${phoneNumber}`;
            
            const institution = await db.institution.get(1);
            const institutionName = institution?.name || 'la institución';

            const message = `Estimado/a ${representative.fullName}, se le recuerda su cita en el DECE de ${institutionName} el día ${Utils.formatDate(appointment.date)} a las ${appointment.startTime}h.\nMotivo: ${appointment.reason}.\n\nSaludos cordiales.`;

            const encodedMessage = encodeURIComponent(message);
            const url = `https://wa.me/${fullPhoneNumber}?text=${encodedMessage}`;

            window.open(url, '_blank');

        } catch (error) {
            console.error("Error sending WhatsApp notification:", error);
            alert("No se pudo generar el enlace de WhatsApp.");
        }
    };

    if (isEditing && event.type === 'activity') {
        return <ActivityModal isOpen={true} onClose={() => { setIsEditing(false); onClose(); }} selectedDate={new Date(event.data.date)} activity={event.data} />;
    }
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Detalle del Evento" size="lg">
            <div className="space-y-4">
                <h3 className="text-xl font-bold">{event.type === 'activity' ? event.data.topic : event.type === 'appointment' ? event.data.title : `Seguimiento: ${event.data.studentName}`}</h3>

                {event.type === 'appointment' && (
                    <>
                        <p><span className="font-semibold">Fecha:</span> {Utils.formatDate(event.data.date)}</p>
                        <p><span className="font-semibold">Hora:</span> {event.data.startTime}</p>
                        <p><span className="font-semibold">Estado:</span> <span className={`px-2 py-0.5 text-xs rounded-full ${Utils.getAppointmentStatusBadge(event.data.status)}`}>{event.data.status}</span></p>
                    </>
                )}
                {event.type === 'activity' && (
                     <p><span className="font-semibold">Fecha:</span> {Utils.formatDate(event.data.date)} {event.data.endDate && event.data.endDate !== event.data.date && ` - ${Utils.formatDate(event.data.endDate)}`}</p>
                )}
                 {event.type === 'followup' && (
                    <>
                     <p><span className="font-semibold">Fecha Límite:</span> {Utils.formatDate(event.data.dueDate)}</p>
                    </>
                )}

                {event.type === 'activity' && event.data.description && <p><span className="font-semibold">Descripción:</span> {event.data.description}</p>}
                {event.type === 'appointment' && <p><span className="font-semibold">Motivo:</span> {event.data.reason}</p>}
                
                <div className="flex flex-wrap gap-2 pt-4 border-t dark:border-gray-700">
                    {event.type === 'appointment' && <>
                        {event.data.status !== 'Realizada' && (
                            <button onClick={() => setIsAttentionModalOpen(true)} className="btn-primary flex-1">Registrar Atención</button>
                        )}
                         {event.data.attendeeType === 'Representante' && event.data.status === 'Realizada' &&
                            <button onClick={() => setIsAttentionModalOpen(true)} className="btn-secondary flex-1">Certificado de Asistencia</button>
                        }
                        <button onClick={() => PdfGenerator.generateCitationPdf(event.data)} className="btn-secondary flex-1">Reimprimir Citación</button>
                        {event.data.attendeeType === 'Representante' && (
                             <button onClick={handleNotifyWhatsApp} className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-semibold">
                                <MessageSquare size={18}/> Notificar WhatsApp
                            </button>
                        )}
                    </>}
                    {event.type === 'activity' && <>
                        <button onClick={handleMarkAsExecuted} disabled={!isPast || event.data.isExecuted} className="btn-primary flex-1">Marcar como Ejecutada</button>
                        <button onClick={() => setIsEditing(true)} disabled={isPast} className="btn-secondary flex-1">Reprogramar</button>
                    </>}
                     {event.type !== 'followup' && <button onClick={() => setConfirmingDelete(true)} className="btn-danger flex-1">Eliminar</button>}
                </div>
                {isConfirmingDelete && (
                    <div className="p-4 bg-red-100 dark:bg-red-900/50 rounded-md text-center">
                        <p className="font-semibold">¿Seguro que desea eliminar este evento?</p>
                        <div className="flex justify-center gap-4 mt-2">
                            <button onClick={() => setConfirmingDelete(false)} className="btn-secondary px-6">No</button>
                            <button onClick={handleDelete} className="btn-danger px-6">Sí, eliminar</button>
                        </div>
                    </div>
                )}
            </div>
            {isParticipantsModalOpen && event.type === 'activity' && <ParticipantsCountModal isOpen={true} onClose={() => { setParticipantsModalOpen(false); onClose(); }} activity={event.data} />}
            {isAttentionModalOpen && event.type === 'appointment' && (
                <AttentionModal 
                    isOpen={true} 
                    onClose={() => {setIsAttentionModalOpen(false); onClose(); }} 
                    appointment={event.data}
                    currentUser={currentUser}
                />
            )}
        </Modal>
    );
};

export default EventDetailModal;
