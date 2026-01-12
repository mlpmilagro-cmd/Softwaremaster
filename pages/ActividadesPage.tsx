
import React, { useState, useEffect, FC } from 'react';
import { db } from '../database';
import type { PreventiveActivity } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { PlusCircle, Printer, Edit, Trash2, FileBarChart2 } from 'lucide-react';
import Card from '../components/shared/Card';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { Utils } from '../utils/helpers';
import { PdfGenerator } from '../utils/pdf';
import { ExcelGenerator } from '../utils/excel';
import Modal from '../components/shared/Modal';

const PreventiveActivityFormModal: FC<{
    isOpen: boolean;
    onClose: () => void;
    itemToEdit: PreventiveActivity | null;
}> = ({ isOpen, onClose, itemToEdit }) => {
    const [formData, setFormData] = useState<Partial<PreventiveActivity>>({});
    const AUDIENCE_OPTIONS: PreventiveActivity['audience'][0][] = ['Estudiantes', 'Padres', 'Docentes', 'Autoridades'];

    useEffect(() => {
        if (itemToEdit) {
            setFormData(itemToEdit);
        } else {
            setFormData({
                date: new Date().toISOString().split('T')[0],
                audience: [],
                attendeesMale: 0,
                attendeesFemale: 0
            });
        }
    }, [itemToEdit, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'number') {
            setFormData(prev => ({ ...prev, [name]: Number(value) >= 0 ? Number(value) : 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleAudienceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { value, checked } = e.target;
        const audienceValue = value as PreventiveActivity['audience'][0];
        setFormData(prev => {
            const currentAudience = prev.audience || [];
            if (checked) {
                return { ...prev, audience: [...currentAudience, audienceValue] };
            } else {
                return { ...prev, audience: currentAudience.filter(item => item !== audienceValue) };
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.topic || !formData.date) {
            alert('Por favor complete todos los campos obligatorios.');
            return;
        }
        try {
            if (itemToEdit) {
                await db.preventiveActivities.update(itemToEdit.id!, formData);
            } else {
                await db.preventiveActivities.add(formData as PreventiveActivity);
            }
            onClose();
        } catch (error) {
            console.error("Error saving preventive activity:", error);
            alert(`Error al guardar: ${error}`);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={itemToEdit ? "Editar Actividad Preventiva" : "Nueva Actividad Preventiva"} size="xl">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                        <label>Tema de la Actividad</label>
                        <input type="text" name="topic" value={formData.topic || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                    <div>
                        <label>Fecha</label>
                        <input type="date" name="date" value={formData.date || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" required />
                    </div>
                     <div>
                        <label>Institución Cooperante (Opcional)</label>
                        <input type="text" name="cooperatingInstitution" value={formData.cooperatingInstitution || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label>Hora de Inicio</label>
                        <input type="time" name="startTime" value={formData.startTime || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label>Hora de Fin</label>
                        <input type="time" name="endTime" value={formData.endTime || ''} onChange={handleChange} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="sm:col-span-2">
                        <label>Audiencia</label>
                        <div className="mt-2 flex flex-wrap gap-4">
                            {AUDIENCE_OPTIONS.map(option => (
                                <label key={option} className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        value={option}
                                        checked={formData.audience?.includes(option)}
                                        onChange={handleAudienceChange}
                                        className="h-4 w-4 rounded border-gray-300 text-dece-blue-600 focus:ring-dece-blue-500"
                                    />
                                    <span>{option}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label>Nº Asistentes (Hombres)</label>
                        <input type="number" name="attendeesMale" value={formData.attendeesMale || 0} onChange={handleChange} min="0" className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div>
                        <label>Nº Asistentes (Mujeres)</label>
                        <input type="number" name="attendeesFemale" value={formData.attendeesFemale || 0} onChange={handleChange} min="0" className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600" />
                    </div>
                    <div className="sm:col-span-2">
                        <label>Resultados y Conclusiones</label>
                        <textarea name="results" value={formData.results || ''} onChange={handleChange} rows={4} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600"></textarea>
                    </div>
                </div>
                <div className="flex justify-end pt-4 gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Cancelar</button>
                    <button type="submit" className="px-4 py-2 rounded bg-dece-blue-600 text-white hover:bg-dece-blue-700 font-semibold">Guardar</button>
                </div>
            </form>
        </Modal>
    );
};

const ActividadesPage: FC = () => {
    const activities = useLiveQuery(() => db.preventiveActivities.orderBy('date').reverse().toArray());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [itemToEdit, setItemToEdit] = useState<PreventiveActivity | null>(null);
    const [isPdfLoading, setIsPdfLoading] = useState(false);
    const [isExcelLoading, setIsExcelLoading] = useState(false);
    
    const handleDelete = async (id: number) => {
        if(window.confirm('¿Está seguro de que desea eliminar esta actividad?')) {
            try {
                await db.preventiveActivities.delete(id);
                alert('Actividad eliminada con éxito.');
            } catch (error) {
                console.error('Error al eliminar actividad:', error);
                alert(`No se pudo eliminar la actividad. Error: ${error}`);
            }
        }
    };

    const handleGenerateReport = async () => {
        if (!activities) return;
        setIsPdfLoading(true);
        try {
            const title = "Reporte de Actividades Preventivas";
            const columns = ["Fecha", "Tema", "Audiencia", "Asistentes", "Institución Cooperante"];
            const body = activities.map(item => [
                Utils.formatDate(item.date),
                item.topic,
                (item.audience || []).join(', '), // Defensive check
                (item.attendeesMale || 0) + (item.attendeesFemale || 0),
                item.cooperatingInstitution || 'N/A'
            ]);
            await PdfGenerator.generateReportPdf(title, columns, body, "Ninguno");
        } catch (e) {
            alert(`Error al generar PDF: ${e}`);
        } finally {
            setIsPdfLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (!activities) return;
        setIsExcelLoading(true);
        try {
            await ExcelGenerator.exportPreventiveActivities(activities);
        } catch (e) {
            alert(`Error al generar Excel: ${e}`);
        } finally {
            setIsExcelLoading(false);
        }
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Actividades Preventivas</h1>
            <Card>
                <div className="flex justify-end gap-2 mb-4">
                     <button onClick={handleExportExcel} disabled={isExcelLoading} className="btn-secondary flex items-center gap-2">
                       <FileBarChart2 size={18} /> {isExcelLoading ? 'Generando...' : 'Exportar a Excel'}
                    </button>
                     <button onClick={handleGenerateReport} disabled={isPdfLoading} className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 font-semibold disabled:bg-gray-400">
                       <Printer size={18} /> {isPdfLoading ? 'Generando...' : 'Generar Reporte'}
                    </button>
                    <button onClick={() => { setItemToEdit(null); setIsModalOpen(true); }} className="flex items-center gap-2 bg-dece-blue-600 text-white px-4 py-2 rounded-md hover:bg-dece-blue-700 font-semibold">
                        <PlusCircle size={18} /> Nueva Actividad
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-3 text-left">Tema</th>
                                <th className="p-3 text-left">Fecha</th>
                                <th className="p-3 text-left hidden sm:table-cell">Audiencia</th>
                                <th className="p-3 text-left">Asistentes</th>
                                <th className="p-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {!activities ? (<tr><td colSpan={5}><LoadingSpinner/></td></tr>) : activities.map(item => (
                                <tr key={item.id} className="border-b dark:border-gray-700">
                                    <td className="p-3 font-medium">{item.topic}</td>
                                    <td className="p-3">{Utils.formatDate(item.date)}</td>
                                    <td className="p-3 hidden sm:table-cell">{(item.audience || []).join(', ')}</td>
                                    <td className="p-3">{(item.attendeesMale || 0) + (item.attendeesFemale || 0)}</td>
                                    <td className="p-3 text-right">
                                        <button onClick={() => { setItemToEdit(item); setIsModalOpen(true); }} className="p-1 text-yellow-500 hover:text-yellow-700" title="Editar"><Edit size={18} /></button>
                                        <button onClick={() => handleDelete(item.id!)} className="p-1 text-red-500 hover:text-red-700" title="Eliminar"><Trash2 size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
            {isModalOpen && <PreventiveActivityFormModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} itemToEdit={itemToEdit} />}
        </div>
    );
};

export default ActividadesPage;