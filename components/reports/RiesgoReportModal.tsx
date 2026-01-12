import React, { useState, useMemo, FC } from 'react';
import { db } from '../../database';
import type { Course, CaseCategoryItem } from '../../database';
import Modal from '../shared/Modal';
import { PdfGenerator } from '../../utils/pdf';
import LoadingSpinner from '../shared/LoadingSpinner';

interface RiesgoReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    courses: Course[];
    categories: CaseCategoryItem[];
}

const RiesgoReportModal: FC<RiesgoReportModalProps> = ({ isOpen, onClose, courses, categories }) => {
    const [filterType, setFilterType] = useState('institution');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [selectedParallel, setSelectedParallel] = useState('');
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const uniqueCourseNames = useMemo(() => {
        return [...new Set(courses.map(c => c.name))].sort();
    }, [courses]);

    const availableParallels = useMemo(() => {
        if (!selectedCourse) return [];
        return [...new Set(courses.filter(c => c.name === selectedCourse).map(c => c.parallel))].sort();
    }, [selectedCourse, courses]);

    const handleCategoryChange = (categoryId: number) => {
        setSelectedCategoryIds(prev =>
            prev.includes(categoryId)
                ? prev.filter(id => id !== categoryId)
                : [...prev, categoryId]
        );
    };

    const handleGenerate = async () => {
        if (selectedCategoryIds.length === 0) {
            alert('Por favor, seleccione al menos una categoría de riesgo.');
            return;
        }
        if (filterType === 'course' && (!selectedCourse || !selectedParallel)) {
            alert('Por favor, seleccione un curso y paralelo.');
            return;
        }
        
        setIsGenerating(true);
        try {
            const filterOptions = {
                type: filterType as 'institution' | 'course',
                course: selectedCourse,
                parallel: selectedParallel,
                categoryIds: selectedCategoryIds
            };
            await PdfGenerator.generateRiesgoReportPdf(filterOptions);
            onClose();
        } catch (error) {
            console.error("Error generating Riesgo report:", error);
            alert(`No se pudo generar el informe: ${error}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Generar Informe de Grupos de Riesgo" size="lg">
            {isGenerating ? (
                <div className="text-center p-8">
                    <LoadingSpinner />
                    <p className="mt-4">Generando informe, por favor espere...</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="font-semibold">Filtrar por</label>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                            <option value="institution">Toda la Institución</option>
                            <option value="course">Curso Específico</option>
                        </select>
                    </div>

                    {filterType === 'course' && (
                        <div className="grid grid-cols-2 gap-4 p-3 border rounded-md">
                            <div>
                                <label>Curso</label>
                                <select value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setSelectedParallel(''); }} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                                    <option value="">Seleccione...</option>
                                    {uniqueCourseNames.map(name => <option key={name} value={name}>{name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label>Paralelo</label>
                                <select value={selectedParallel} onChange={e => setSelectedParallel(e.target.value)} disabled={!selectedCourse} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-600">
                                    <option value="">Seleccione...</option>
                                    {availableParallels.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="font-semibold">Seleccionar Categorías de Riesgo</label>
                        <div className="mt-2 p-3 border rounded-md max-h-48 overflow-y-auto grid grid-cols-2 gap-2">
                            {categories.map(cat => (
                                <label key={cat.id} className="flex items-center space-x-2">
                                    <input type="checkbox" checked={selectedCategoryIds.includes(cat.id!)} onChange={() => handleCategoryChange(cat.id!)} className="h-4 w-4 rounded border-gray-300 text-dece-blue-600 focus:ring-dece-blue-500"/>
                                    <span>{cat.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end pt-4 gap-3 border-t dark:border-gray-700">
                        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                        <button onClick={handleGenerate} disabled={selectedCategoryIds.length === 0} className="btn-primary">Generar PDF</button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default RiesgoReportModal;
