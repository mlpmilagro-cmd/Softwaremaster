import React, { useState, FC, useEffect } from 'react';
import Card from '../components/shared/Card';
import { ExcelGenerator } from '../utils/excel';
import { PdfGenerator } from '../utils/pdf';
import { db } from '../database';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import type { CaseFile, FollowUp, PreventiveActivity } from '../database';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';

const ReportsPage: FC = () => {
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(1);
        return date.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [reportData, setReportData] = useState<{
        categoryData: { name: string, atenciones: number }[];
        participantData: { name: string, atenciones: number }[];
        attentionMatrix: { category: string; [key: string]: string | number }[];
        allCategories: string[];
        activitiesData: any[];
    } | null>(null);

    const participantMapping: { [key: string]: string } = {
        'Estudiante': 'Estudiante',
        'Representante': 'Padre de Familia',
        'Docente': 'Docente',
        'Autoridad': 'Directivo',
    };
    const participantHeaders = ['Estudiante', 'Padre de Familia', 'Docente', 'Directivo'];

    useEffect(() => {
        const fetchData = async () => {
            setIsGenerating(true);
            try {
                const followUps = await db.followUps
                    .where('date').between(startDate, endDate, true, true)
                    .and(f => f.isEffective === true)
                    .toArray();

                const activities = await db.preventiveActivities
                    .where('date').between(startDate, endDate, true, true)
                    .and(a => a.isExecuted === true)
                    .toArray();
                
                const caseIds = [...new Set(followUps.map(f => f.caseId))];
                const cases: CaseFile[] = await db.caseFiles.where('id').anyOf(caseIds).toArray();
                const allDbCategories = await db.caseCategories.toArray();
                const allCategories = allDbCategories.map(c => c.name).sort();
                // FIX: Add explicit type argument to Map constructor for correct type inference.
                const caseMap = new Map<number, string>(cases.filter(c => c.id != null).map(c => [c.id!, c.category]));
                
                const categoryCounts: Record<string, number> = {};
                const participantCounts: Record<string, number> = {};
                
                const matrix: Record<string, Record<string, number>> = {};
                allCategories.forEach(cat => {
                    matrix[cat] = {};
                    participantHeaders.forEach(p => matrix[cat][p] = 0);
                });
                
                followUps.forEach(f => {
                    // FIX: Add explicit type annotation to resolve 'Type 'unknown' cannot be used as an index type'.
                    const category: string | undefined = caseMap.get(f.caseId);
                    if (category) {
                        categoryCounts[category] = (categoryCounts[category] || 0) + 1;

                        (f.participantType || []).forEach(pType => {
                            // FIX: Add explicit type annotation to resolve 'Type 'unknown' cannot be used as an index type'.
                            const mappedParticipant: string | undefined = participantMapping[pType as keyof typeof participantMapping];
                            if(mappedParticipant) {
                                participantCounts[mappedParticipant] = (participantCounts[mappedParticipant] || 0) + 1;
                                if (matrix[category]) {
                                    matrix[category][mappedParticipant]++;
                                }
                            }
                        });
                    }
                });
                
                const categoryData = Object.entries(categoryCounts).map(([name, atenciones]) => ({ name, atenciones })).sort((a,b) => b.atenciones - a.atenciones);
                const participantData = Object.entries(participantCounts).map(([name, atenciones]) => ({ name, atenciones })).sort((a,b) => b.atenciones - a.atenciones);
                
                const attentionMatrix = allCategories.map(category => ({
                    category,
                    ...matrix[category]
                }));
                
                const activitiesData = activities.map(act => ({
                    name: act.topic,
                    date: act.date,
                    audience: (act.audience || []).join(', '),
                    estudiantes: (act.attendeesMale ?? 0) + (act.attendeesFemale ?? 0),
                    padres: act.attendeesParents ?? 0,
                    docentes: act.attendeesTeachers ?? 0,
                    directivos: act.attendeesDirectors ?? 0,
                    total: (act.attendeesMale ?? 0) + (act.attendeesFemale ?? 0) + (act.attendeesParents ?? 0) + (act.attendeesTeachers ?? 0) + (act.attendeesDirectors ?? 0)
                }));

                setReportData({ categoryData, participantData, attentionMatrix, allCategories, activitiesData });

            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setIsGenerating(false);
            }
        };

        fetchData();
    }, [startDate, endDate]);

    const handleGenerateExcelReport = async () => {
        setIsGenerating(true);
        try {
            const cases = await db.caseFiles.where('openingDate').between(startDate, endDate, true, true).toArray();
            const activities = await db.preventiveActivities.where('date').between(startDate, endDate, true, true).toArray();
            const followUps = await db.followUps.where('date').between(startDate, endDate, true, true).and(f => f.isEffective === true).toArray();
            await ExcelGenerator.generateGeneralStatisticsReport({ cases, activities, followUps });
        } catch (error) {
            console.error("Failed to generate Excel report:", error);
            alert(`No se pudo generar el reporte Excel: ${error}`);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGeneratePdfReport = async () => {
        if (!reportData) return;
        setIsGenerating(true);
        try {
            await PdfGenerator.generateGeneralReportPdf(startDate, endDate, reportData.attentionMatrix, participantHeaders, reportData.activitiesData);
        } catch (error) {
            console.error("Failed to generate PDF report:", error);
            alert(`No se pudo generar el reporte PDF: ${error}`);
        } finally {
            setIsGenerating(false);
        }
    };
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Reportes y Estadísticas</h1>
            
            <Card>
                <div className="p-4 space-y-6">
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border rounded-lg dark:border-gray-700">
                        <h2 className="text-lg font-semibold">Seleccione Período</h2>
                        <div className="flex items-center gap-2">
                            <label htmlFor="start-date">Desde:</label>
                            <input type="date" id="start-date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" disabled={isGenerating} />
                        </div>
                        <div className="flex items-center gap-2">
                             <label htmlFor="end-date">Hasta:</label>
                            <input type="date" id="end-date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600" disabled={isGenerating} />
                        </div>
                    </div>
                    
                    {isGenerating ? (
                        <div className="py-10"><LoadingSpinner /></div>
                    ) : reportData ? (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 text-center">Atenciones por Categoría</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={reportData.categoryData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="atenciones" fill="#0ea5e9" name="Atenciones" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                                 <div>
                                    <h3 className="text-lg font-semibold mb-4 text-center">Atenciones por Participante</h3>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={reportData.participantData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="name" />
                                            <YAxis />
                                            <Tooltip />
                                            <Legend />
                                            <Bar dataKey="atenciones" fill="#10b981" name="Atenciones" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <h3 className="text-lg font-semibold mb-2 text-center">Detalle de Atenciones por Categoría y Participante</h3>
                                <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
                                    <thead>
                                        <tr className="bg-dece-blue-700 text-white">
                                            <th className="p-2 font-semibold text-left border-r dark:border-gray-600">Categoría</th>
                                            {participantHeaders.map(p => (
                                                <th key={p} className="p-2 font-semibold text-center border-r dark:border-gray-600">{p}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.attentionMatrix.map(({ category, ...counts }) => (
                                            <tr key={category} className="border-b dark:border-gray-600 even:bg-gray-50 dark:even:bg-gray-800/50">
                                                <td className="p-2 border-r font-semibold text-left dark:border-gray-600">{category}</td>
                                                {participantHeaders.map(p => (
                                                    <td key={p} className="p-2 border-r text-center dark:border-gray-600">{(counts[p] as number) || 0}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <h3 className="text-lg font-semibold my-4 text-center">Detalle de Actividades Preventivas Ejecutadas</h3>
                                <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
                                     <thead>
                                        <tr className="bg-dece-blue-700 text-white">
                                            <th className="p-2 font-semibold text-left border-r dark:border-gray-600">Fecha</th>
                                            <th className="p-2 font-semibold text-left border-r dark:border-gray-600">Tema</th>
                                            <th className="p-2 font-semibold text-center border-r dark:border-gray-600">Est.</th>
                                            <th className="p-2 font-semibold text-center border-r dark:border-gray-600">Padres</th>
                                            <th className="p-2 font-semibold text-center border-r dark:border-gray-600">Doc.</th>
                                            <th className="p-2 font-semibold text-center border-r dark:border-gray-600">Dir.</th>
                                            <th className="p-2 font-semibold text-center">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.activitiesData.map((act) => (
                                            <tr key={`${act.date}-${act.name}`} className="border-b dark:border-gray-600 even:bg-gray-50 dark:even:bg-gray-800/50">
                                                <td className="p-2 border-r dark:border-gray-600">{act.date}</td>
                                                <td className="p-2 border-r dark:border-gray-600">{act.name}</td>
                                                <td className="p-2 border-r text-center dark:border-gray-600">{act.estudiantes}</td>
                                                <td className="p-2 border-r text-center dark:border-gray-600">{act.padres}</td>
                                                <td className="p-2 border-r text-center dark:border-gray-600">{act.docentes}</td>
                                                <td className="p-2 border-r text-center dark:border-gray-600">{act.directivos}</td>
                                                <td className="p-2 text-center font-bold">{act.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                        </div>
                    ) : null}

                    <div className="flex flex-col sm:flex-row justify-center gap-4 pt-6 border-t dark:border-gray-700">
                        <button onClick={handleGenerateExcelReport} disabled={isGenerating} className="btn-primary px-6 py-3 text-base">
                            {isGenerating ? 'Generando...' : 'Generar Reporte Excel'}
                        </button>
                        <button onClick={handleGeneratePdfReport} disabled={isGenerating} className="btn-secondary px-6 py-3 text-base">
                            {isGenerating ? 'Generando...' : 'Generar Reporte PDF'}
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default ReportsPage;