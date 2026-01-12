import React, { useState, useMemo, FC } from 'react';
import { db } from '../../database';
import type { Course } from '../../database';
import Modal from '../shared/Modal';
import { PdfGenerator } from '../../utils/pdf';
import LoadingSpinner from '../shared/LoadingSpinner';

interface JuntasReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    courses: Course[];
}

const JuntasReportModal: FC<JuntasReportModalProps> = ({ isOpen, onClose, courses }) => {
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedParallel, setSelectedParallel] = useState('');
    const [reportTitle, setReportTitle] = useState('PRIMER TRIMESTRE');
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 3);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [isGenerating, setIsGenerating] = useState(false);

    const uniqueCourseNames = useMemo(() => {
        return [...new Set(courses.map(c => c.name))].sort();
    }, [courses]);

    const availableParallels = useMemo(() => {
        if (!selectedCourse) return [];
        return [...new Set(courses.filter(c => c.name === selectedCourse).map(c => c.parallel))].sort();
    }, [selectedCourse, courses]);
    
    const handleGenerate = async () => {
        if (!selectedCourse || !selectedParallel) {
            alert('Por favor, seleccione un curso y un paralelo.');
            return;
        }
        setIsGenerating(true);
        try {
            await PdfGenerator.generateJuntasReportPdf({
                courseName: selectedCourse, 
                parallel: selectedParallel,
                reportTitle,
                startDate,
                endDate
            });
            onClose();
        } catch (error) {
            console.error("Error generating Juntas report:", error);
            alert(`No se pudo generar el informe: ${error}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generar Informe para Junta de Curso">
            {isGenerating ? (
                <div className="text-center p-8">
                    <LoadingSpinner />
                    <p className="mt-4">Generando informe con estructura oficial...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                        Configure los datos para el reporte oficial de la Junta de Grado o Curso.
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Curso</label>
                            <select
                                value={selectedCourse}
                                onChange={(e) => {
                                    setSelectedCourse(e.target.value);
                                    setSelectedParallel('');
                                }}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            >
                                <option value="">Seleccione...</option>
                                {uniqueCourseNames.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Paralelo</label>
                            <select
                                value={selectedParallel}
                                onChange={(e) => setSelectedParallel(e.target.value)}
                                disabled={!selectedCourse}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-600"
                            >
                                <option value="">Seleccione...</option>
                                {availableParallels.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-1">Título del Reporte (Ej: PRIMER TRIMESTRE)</label>
                        <input 
                            type="text" 
                            value={reportTitle} 
                            onChange={(e) => setReportTitle(e.target.value.toUpperCase())}
                            className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            placeholder="PRIMER TRIMESTRE"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Fecha Inicio Atenciones</label>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Fecha Fin Atenciones</label>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-3 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button onClick={handleGenerate} disabled={!selectedCourse || !selectedParallel} className="btn-primary">Generar Reporte PDF</button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default JuntasReportModal;