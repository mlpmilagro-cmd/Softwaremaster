
import React, { useState, useEffect, FC } from 'react';
import { db } from '../../database';
import type { PsychosocialInterview, CaseFile, Student } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../shared/Modal';
import { STUDENT_INTERVIEW_QUESTIONS, TEACHER_INTERVIEW_QUESTIONS, REPRESENTATIVE_INTERVIEW_QUESTIONS } from '../../utils/interviewQuestions';
import LoadingSpinner from '../shared/LoadingSpinner';
import { PdfGenerator } from '../../utils/pdf';
import { FileDown } from 'lucide-react';

interface PsychosocialInterviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseFile: CaseFile;
    student: Student | undefined;
}

type InterviewType = 'Estudiante' | 'Docente' | 'Representante';

const interviewConfig = {
    'Estudiante': STUDENT_INTERVIEW_QUESTIONS,
    'Docente': TEACHER_INTERVIEW_QUESTIONS,
    'Representante': REPRESENTATIVE_INTERVIEW_QUESTIONS
};

const PsychosocialInterviewModal: FC<PsychosocialInterviewModalProps> = ({ isOpen, onClose, caseFile, student }) => {
    const [activeTab, setActiveTab] = useState<InterviewType>('Estudiante');
    const [formData, setFormData] = useState<Record<InterviewType, any>>({
        'Estudiante': {},
        'Docente': {},
        'Representante': {}
    });

    const caseFileId = caseFile.id!;
    const interviews = useLiveQuery(() => db.psychosocialInterviews.where({ caseFileId }).toArray(), [caseFileId]);

    useEffect(() => {
        if (interviews) {
            const initialData: Record<InterviewType, any> = { 'Estudiante': {}, 'Docente': {}, 'Representante': {} };
            interviews.forEach(interview => {
                initialData[interview.interviewType] = interview.formData;
            });
            setFormData(initialData);
        }
    }, [interviews]);

    const handleFormChange = (section: string, key: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                [section]: {
                    ...prev[activeTab][section],
                    [key]: value
                }
            }
        }));
    };

    const handleSave = async () => {
        try {
            // FIX: Use `where()` on the compound index `[caseFileId+interviewType]` to find the existing record.
            // `get()` only works on the primary key (`id`).
            const existingInterview = await db.psychosocialInterviews.where('[caseFileId+interviewType]').equals([caseFileId, activeTab]).first();
            
            const interviewData: PsychosocialInterview = {
                id: existingInterview?.id,
                caseFileId,
                interviewType: activeTab,
                formData: formData[activeTab],
                completedDate: new Date().toISOString().split('T')[0]
            };
            await db.psychosocialInterviews.put(interviewData);
            alert(`Entrevista de ${activeTab} guardada con éxito.`);
        } catch (error) {
            console.error("Error saving interview:", error);
            alert(`Error al guardar: ${error}`);
        }
    };
    
    const handleExport = async () => {
        if (!student) {
            alert("Información del estudiante no encontrada.");
            return;
        }
        try {
            await PdfGenerator.generateInterviewPdf(caseFile, student, activeTab, formData[activeTab]);
        } catch (error) {
            console.error("Error exporting interview PDF:", error);
            alert(`Error al exportar: ${error}`);
        }
    };

    const renderForm = (type: InterviewType) => {
        const questions = interviewConfig[type];
        const data = formData[type] || {};

        return (
            <div className="space-y-4">
                {Object.entries(questions).map(([section, fields]) => (
                    <fieldset key={section} className="p-3 border rounded-md">
                        <legend className="px-2 font-semibold text-sm">{section}</legend>
                        {fields.map(field => (
                            <div key={field.key} className="mt-2">
                                <label className="block text-sm font-medium mb-1">{field.label}</label>
                                <textarea
                                    rows={4}
                                    value={data[section]?.[field.key] || ''}
                                    onChange={e => handleFormChange(section, field.key, e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-gray-800 dark:border-gray-600 text-sm"
                                />
                            </div>
                        ))}
                    </fieldset>
                ))}
            </div>
        );
    };

    const isCurrentInterviewSaved = !!interviews?.find(i => i.interviewType === activeTab);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Entrevistas Psicosociales" size="2xl">
            <div className="flex border-b mb-4">
                {(Object.keys(interviewConfig) as InterviewType[]).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`py-2 px-4 text-sm font-medium ${activeTab === tab ? 'border-b-2 border-dece-blue-500 text-dece-blue-600' : 'text-gray-500'}`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-1">
                {!interviews ? <LoadingSpinner/> : renderForm(activeTab)}
            </div>

            <div className="flex justify-end pt-4 mt-4 border-t gap-3">
                 <button 
                    onClick={handleExport} 
                    disabled={!isCurrentInterviewSaved} 
                    className="btn-secondary flex items-center gap-2"
                    title={!isCurrentInterviewSaved ? 'Guarde la entrevista primero para poder exportarla' : 'Exportar a PDF'}
                >
                    <FileDown size={18}/> Exportar a PDF
                </button>
                <button onClick={handleSave} className="btn-primary">
                    Guardar Entrevista de {activeTab}
                </button>
            </div>
        </Modal>
    );
};

export default PsychosocialInterviewModal;
