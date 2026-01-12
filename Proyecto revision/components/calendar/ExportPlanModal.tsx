
import React, { FC } from 'react';
import Modal from '../shared/Modal';

interface ExportPlanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: (period: 'semana' | 'mes' | 'trimestre' | 'año') => void;
}

const ExportPlanModal: FC<ExportPlanModalProps> = ({isOpen, onClose, onExport}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Exportar Plan de Actividades">
            <div className="space-y-3">
                <p>Seleccione el periodo que desea exportar:</p>
                <button onClick={() => onExport('semana')} className="btn-secondary w-full">Esta Semana</button>
                <button onClick={() => onExport('mes')} className="btn-secondary w-full">Este Mes</button>
                <button onClick={() => onExport('trimestre')} className="btn-secondary w-full">Este Trimestre</button>
                <button onClick={() => onExport('año')} className="btn-secondary w-full">Este Año</button>
            </div>
        </Modal>
    )
};

export default ExportPlanModal;
