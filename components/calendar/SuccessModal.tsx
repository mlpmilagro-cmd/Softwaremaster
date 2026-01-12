import React, { FC } from 'react';
import { CheckCircle, MessageSquare } from 'lucide-react';
import type { Appointment, User } from '../../database';
import { db } from '../../database';
import { PdfGenerator } from '../../utils/pdf';
import Modal from '../shared/Modal';
import { Utils } from '../../utils/helpers';

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: Appointment;
}

const SuccessModal: FC<SuccessModalProps> = ({isOpen, onClose, appointment}) => {

    const handleNotifyWhatsApp = async () => {
        if (appointment.attendeeType !== 'Representante') {
            alert('Solo se puede notificar a representantes.');
            return;
        }

        try {
            const representative = await db.representatives.get(appointment.attendeeId);
            if (!representative || !representative.phone) {
                alert('El representante no tiene un número de teléfono registrado.');
                return;
            }

            // Format phone number: remove leading 0, prepend 593
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

    const canNotify = appointment.attendeeType === 'Representante';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Cita Agendada con Éxito">
            <div className="text-center">
                <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
                <p className="mb-6">La cita ha sido creada correctamente.</p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <button onClick={() => PdfGenerator.generateCitationPdf(appointment)} className="btn-primary w-full flex-1">Descargar Citación (PDF)</button>
                    {canNotify && (
                        <button onClick={handleNotifyWhatsApp} className="w-full flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md font-semibold">
                            <MessageSquare size={18}/> Notificar por WhatsApp
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default SuccessModal;