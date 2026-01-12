import React, { useState, FC, useEffect } from 'react';
import { db } from '../../database';
import type { Teacher, EducandoEnFamilia, PefModule } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../shared/Modal';

const CRITERIA = [
    "1. Manifiesta una comprensión básica de los lineamientos y objetivos del Programa Educando en Familia (ideas fuerza).",
    "2. Conoce en detalle el proceso metodológico de implementación del Programa.",
    "3. Muestra entendimiento del enfoque con el cual se aborda el eje temático que corresponda.",
    "4. Muestra predisposición para participar en el Programa",
    "5. Promueve entre las familias del grupo de estudiantes a cargo, la participación y planificación de la campaña correspondiente al módulo en ejecución.",
    "6. Lidera la realización del taller con familias, es decir, comunica con oportunidad a madres y padres, dispone de los materiales y recursos técnicos y evidencia una preparación adecuada en el manejo de la agenda.",
    "7. Realiza la preparación del Encuentro comunitario y jornada de intercambio.",
    "8. Presenta la ficha de evaluación del taller con familias oportunamente al DECE.",
];

interface EvaluationModalProps {
    isOpen: boolean;
    onClose: () => void;
    teacher: Teacher;
}

const EvaluationModal: FC<EvaluationModalProps> = ({ isOpen, onClose, teacher }) => {
    const [selectedModuleId, setSelectedModuleId] = useState('');
    const [formData, setFormData] = useState({
        moduleName: '',
        modality: 'Presencial' as 'Presencial' | 'Virtual',
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
    });
    const [criteriaMet, setCriteriaMet] = useState<boolean[]>(Array(8).fill(false));
    const [observations, setObservations] = useState('');

    const pefModules = useLiveQuery(() => db.pefModules.toArray(), []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const handleModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const moduleId = e.target.value;
        setSelectedModuleId(moduleId);
        const selectedModule = pefModules?.find(m => m.id === Number(moduleId));
        if (selectedModule) {
            setFormData(prev => ({
                ...prev,
                moduleName: selectedModule.name,
                startDate: selectedModule.startDate,
                endDate: selectedModule.endDate,
            }));
        } else {
             setFormData(prev => ({
                ...prev,
                moduleName: '',
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0],
            }));
        }
    };

    const handleCriteriaChange = (index: number) => {
        const newCriteria = [...criteriaMet];
        newCriteria[index] = !newCriteria[index];
        setCriteriaMet(newCriteria);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.moduleName) {
            alert('Por favor, seleccione un módulo.');
            return;
        }

        if (formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
            alert('La fecha de fin no puede ser anterior a la fecha de inicio.');
            return;
        }
        
        const score = criteriaMet.filter(Boolean).length;
        const isApproved = score >= 6;
        let hours = 0;
        if (isApproved) {
            hours = formData.modality === 'Presencial' ? 15 : 10;
        }

        const evaluationData: EducandoEnFamilia = {
            teacherId: teacher.id!,
            moduleName: formData.moduleName,
            modality: formData.modality,
            startDate: formData.startDate,
            endDate: formData.endDate,
            score,
            hours,
            status: isApproved ? 'Aprobado' : 'No Aprobado',
            criteriaMet,
        };

        try {
            await db.educandoEnFamilia.add(evaluationData);
            onClose();
        } catch (error) {
            console.error("Error saving evaluation:", error);
            alert(`Error al guardar la evaluación: ${error}`);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Ficha de Evaluación - ${teacher.fullName}`} size="2xl">
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="p-4 border rounded-lg dark:border-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="sm:col-span-2">
                        <label>Nombre del Módulo</label>
                        <select
                            value={selectedModuleId}
                            onChange={handleModuleChange}
                            className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"
                            required
                        >
                            <option value="">Seleccione un módulo preconfigurado...</option>
                            {pefModules?.map(mod => (
                                <option key={mod.id} value={mod.id!}>{mod.name}</option>
                            ))}
                        </select>
                    </div>
                     <div>
                        <label>Modalidad</label>
                        <select name="modality" value={formData.modality} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                            <option value="Presencial">Presencial</option>
                            <option value="Virtual">Virtual</option>
                        </select>
                    </div>
                    <div><label>Rango de Fechas</label>
                    <div className="flex items-center gap-2 mt-1">
                        <input type="date" name="startDate" value={formData.startDate} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-600" required disabled />
                        <span>-</span>
                        <input type="date" name="endDate" value={formData.endDate} onChange={handleChange} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 disabled:bg-gray-200 dark:disabled:bg-gray-600" required disabled />
                    </div>
                    </div>
                </div>

                <div>
                    <h3 className="font-semibold mb-2">Marque con una X si ha observado los criterios que se describe a continuación:</h3>
                    <div className="space-y-2 p-4 border rounded-lg dark:border-gray-600 max-h-60 overflow-y-auto">
                        {CRITERIA.map((criterion, index) => (
                            <label key={index} className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <input type="checkbox" checked={criteriaMet[index]} onChange={() => handleCriteriaChange(index)} className="h-5 w-5 rounded border-gray-300 text-dece-blue-600 focus:ring-dece-blue-500" />
                                <span className="text-sm">{criterion}</span>
                            </label>
                        ))}
                    </div>
                     <div className="mt-2 text-right font-bold">
                        Calificación: {criteriaMet.filter(Boolean).length} / 8
                    </div>
                </div>

                <div>
                    <label>Observaciones:</label>
                    <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"></textarea>
                </div>
                 <div className="text-xs text-gray-500 dark:text-gray-400">
                    <p>Cada criterio tiene una valoración de 1 punto. Para obtener la aprobación se considerará 6 puntos afirmativos.</p>
                    <p>Si no cumple los criterios, el docente liderará el proceso de balance con sus compañeros, DECE y autoridad.</p>
                </div>
                <div className="flex justify-end pt-4 gap-3 border-t dark:border-gray-700">
                    <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
                    <button type="submit" className="btn-primary">Guardar Evaluación</button>
                </div>
            </form>
        </Modal>
    );
};

export default EvaluationModal;