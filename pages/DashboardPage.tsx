import React, { FC } from 'react';
import { db } from '../database';
import type { CaseFile, PreventiveActivity, Student, CaseStatus, CasePriority } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { FolderOpen, AlertTriangle, ClipboardCheck, Megaphone } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import Card from '../components/shared/Card';
import { Utils } from '../utils/helpers';

const DashboardPage: FC = () => {
    const dashboardData = useLiveQuery(async () => {
        const allCases: CaseFile[] = await db.caseFiles.toArray();
        const allActivities: PreventiveActivity[] = await db.preventiveActivities.toArray();
        const studentIds = allCases.map(c => c.studentId);
        const students: Student[] = await db.students.where('id').anyOf(studentIds).toArray();
        const studentMap = new Map(students.map(s => [s.id, s]));

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const statusCounts = allCases.reduce((acc, c) => {
            acc[c.status] = (acc[c.status] || 0) + 1;
            return acc;
        }, {} as Record<CaseStatus, number>);
        
        const statusChartData = [
            { name: 'Abierto', value: statusCounts.Abierto || 0 },
            { name: 'En proceso', value: statusCounts['En proceso'] || 0 },
            { name: 'Cerrado', value: statusCounts.Cerrado || 0 },
        ];

        const openCases = allCases.filter(c => c.status !== 'Cerrado');

        const priorityCounts = openCases.reduce((acc, c) => {
            acc[c.priority] = (acc[c.priority] || 0) + 1;
            return acc;
        }, {} as Record<CasePriority, number>);

        const priorityChartData = [
            { name: 'Baja', value: priorityCounts.Baja || 0 },
            { name: 'Media', value: priorityCounts.Media || 0 },
            { name: 'Alta', value: priorityCounts.Alta || 0 },
            { name: 'Crítica', value: priorityCounts.Crítica || 0 },
        ];

        const upcomingFollowUps = openCases
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .slice(0, 5)
            .map(c => ({
                ...c,
                studentName: studentMap.get(c.studentId)?.fullName || 'N/A',
                semaforo: Utils.getSemaforoColor(c.dueDate),
            }));
        
        const upcomingActivities = allActivities
            .filter(a => new Date(a.date) >= today)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 5);

        const categoryCounts = allCases.reduce((acc, c) => {
            acc[c.category] = (acc[c.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const categoryChartData = Object.entries(categoryCounts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
            
        const activitiesThisMonth = allActivities.filter(a => 
            new Date(a.date).getMonth() === today.getMonth() && 
            new Date(a.date).getFullYear() === today.getFullYear()
        );

        const executedActivitiesThisMonth = activitiesThisMonth.filter(a => a.isExecuted);

        const totalAttendeesThisMonth = executedActivitiesThisMonth.reduce((sum, act) => {
            return sum + 
                   (act.attendeesMale || 0) + 
                   (act.attendeesFemale || 0) +
                   (act.attendeesParents || 0) +
                   (act.attendeesTeachers || 0) +
                   (act.attendeesDirectors || 0);
        }, 0);

        const kpis = {
            openCases: openCases.length,
            criticalAlerts: priorityCounts.Crítica || 0,
            totalAttendeesThisMonth: totalAttendeesThisMonth,
        };

        return { statusChartData, priorityChartData, upcomingFollowUps, upcomingActivities, categoryChartData, kpis };
    }, []);

    const STATUS_PIE_COLORS = ['#f97316', '#eab308', '#22c55e'];
    const PRIORITY_COLORS: Record<CasePriority, string> = { 'Baja': '#3b82f6', 'Media': '#f59e0b', 'Alta': '#f97316', 'Crítica': '#ef4444' };

    if (!dashboardData) return <LoadingSpinner />;
    
    const { kpis, statusChartData, priorityChartData, categoryChartData, upcomingFollowUps, upcomingActivities } = dashboardData;

    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Gestión del DECE</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
                <Card className="flex items-center">
                    <div className="p-3 rounded-full bg-dece-blue-100 dark:bg-dece-blue-900 mr-4"><FolderOpen size={24} className="text-dece-blue-500" /></div>
                    <div><h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Casos Abiertos</h2><p className="text-2xl font-bold">{kpis.openCases}</p></div>
                </Card>
                <Card className="flex items-center">
                    <div className="p-3 rounded-full bg-red-100 dark:bg-red-900 mr-4"><AlertTriangle size={24} className="text-red-500" /></div>
                    <div><h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Alertas Críticas</h2><p className="text-2xl font-bold">{kpis.criticalAlerts}</p></div>
                </Card>
                <Card className="flex items-center">
                    <div className="p-3 rounded-full bg-green-100 dark:bg-green-900 mr-4"><Megaphone size={24} className="text-green-500" /></div>
                    <div><h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Asistentes a Actividades (Mes)</h2><p className="text-2xl font-bold">{kpis.totalAttendeesThisMonth}</p></div>
                </Card>
                <Card className="flex items-center">
                    <div className="p-3 rounded-full bg-teal-100 dark:bg-teal-900 mr-4"><ClipboardCheck size={24} className="text-teal-500" /></div>
                    <div><h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Total Casos Registrados</h2><p className="text-2xl font-bold">{statusChartData.reduce((a,b) => a + b.value, 0)}</p></div>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
                <Card className="lg:col-span-2">
                    <h2 className="text-xl font-semibold mb-4">Casos por Estado</h2>
                     <ResponsiveContainer width="100%" height={300}>
                       <PieChart>
                           <Pie data={statusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                               {statusChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={STATUS_PIE_COLORS[index % STATUS_PIE_COLORS.length]} />)}
                           </Pie>
                           <Tooltip /><Legend />
                       </PieChart>
                    </ResponsiveContainer>
                </Card>
                <Card className="lg:col-span-3">
                    <h2 className="text-xl font-semibold mb-4">Alertas por Prioridad (Casos Abiertos)</h2>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={priorityChartData}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value">{priorityChartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={PRIORITY_COLORS[entry.name as CasePriority]} />))}</Bar></BarChart>
                    </ResponsiveContainer>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card>
                    <h2 className="text-xl font-semibold mb-4">Próximos Seguimientos</h2>
                    <div className="space-y-3">
                        {upcomingFollowUps.length > 0 ? upcomingFollowUps.map(f => (
                            <div key={f.id} className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-700/50">
                                <div><p className="font-medium">{f.studentName}</p><p className="text-xs text-gray-500 dark:text-gray-400">Vence: {Utils.formatDate(f.dueDate)}</p></div>
                                <span className={`text-xs font-bold px-2 py-1 rounded-full ${f.semaforo.bg} text-white`}>{f.semaforo.label}</span>
                            </div>
                        )) : <p className="text-center text-gray-500 py-4">No hay seguimientos próximos.</p>}
                    </div>
                </Card>
                 <Card>
                    <h2 className="text-xl font-semibold mb-4">Próximas Actividades Preventivas</h2>
                    <div className="space-y-3">
                       {upcomingActivities.length > 0 ? upcomingActivities.map(a => (
                            <div key={a.id} className="flex items-center justify-between p-2 rounded-md bg-gray-50 dark:bg-gray-700/50">
                                <div><p className="font-medium">{a.topic}</p><p className="text-xs text-gray-500 dark:text-gray-400">Fecha: {Utils.formatDate(a.date)}</p></div>
                                <span className="text-xs text-gray-600 dark:text-gray-300">{a.startTime}</span>
                            </div>
                        )) : <p className="text-center text-gray-500 py-4">No hay actividades programadas.</p>}
                    </div>
                </Card>
            </div>
            
            <Card>
                <h2 className="text-xl font-semibold mb-4">Estadísticas de Casos por Categoría</h2>
                <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 20, left: 150, bottom: 5 }}><XAxis type="number" /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="value" fill="#0ea5e9" barSize={20} /></BarChart>
                </ResponsiveContainer>
            </Card>
        </div>
    );
};

export default DashboardPage;