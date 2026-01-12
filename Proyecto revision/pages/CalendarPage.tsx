import React, { useState, useMemo, useCallback, useRef, FC } from 'react';
import { db } from '../database';
import type { Appointment, PreventiveActivity, CaseFile, Student, Representative, Teacher, User } from '../database';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, ChevronRight, PlusCircle, FileText, FileDown } from 'lucide-react';
import Card from '../components/shared/Card';
import { Utils } from '../utils/helpers';
import { PdfGenerator } from '../utils/pdf';
import AppointmentModal from '../components/calendar/AppointmentModal';
import ActivityModal from '../components/calendar/ActivityModal';
import EventDetailModal from '../components/calendar/EventDetailModal';
import CaseDetailModal from '../components/casos/CaseDetailModal';
import ExportPlanModal from '../components/calendar/ExportPlanModal';
import SuccessModal from '../components/calendar/SuccessModal';

// Define a discriminated union for more type-safe event handling
type CalendarEvent =
    | { type: 'appointment'; data: Appointment }
    | { type: 'activity'; data: PreventiveActivity }
    | { type: 'followup'; data: CaseFile & { studentName?: string } };

// Define a combined type for calendar grid event rendering
type DisplayEvent = {
    id: string;
    type: 'appointment' | 'activity' | 'followup';
    originalData: Appointment | PreventiveActivity | (CaseFile & { studentName?: string });
    title: string;
    startDate: Date;
    endDate: Date;
    color: string;
};

const CalendarPage: FC<{ currentUser: User }> = ({ currentUser }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const touchStartRef = useRef<{ x: number; y: number } | null>(null);

    // --- Modal States ---
    const [modal, setModal] = useState<string | null>(null); // 'appointment', 'activity', etc.
    const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
    const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
    const [lastAppointment, setLastAppointment] = useState<Appointment | null>(null);

    const data = useLiveQuery(async () => {
        const appointments = await db.appointments.toArray(); // Show all, not just scheduled
        const activities = await db.preventiveActivities.toArray();
        const casesWithFollowUp = await db.caseFiles.where('status').notEqual('Cerrado').and(c => !!c.dueDate).toArray();
        
        const studentIds = casesWithFollowUp.map(c => c.studentId);
        const students = await db.students.where('id').anyOf(studentIds).toArray();
        const studentMap = new Map(students.map(s => [s.id, s.fullName]));

        const allPeople = {
            students: await db.students.orderBy('fullName').toArray(),
            representatives: await db.representatives.orderBy('fullName').toArray(),
            teachers: await db.teachers.orderBy('fullName').toArray()
        };

        const events: DisplayEvent[] = [];

        appointments.forEach(app => {
            events.push({
                id: `appointment-${app.id}`,
                type: 'appointment',
                originalData: app,
                title: app.title,
                startDate: new Date(`${app.date}T${app.startTime || '00:00'}`),
                endDate: new Date(`${app.date}T${app.endTime || '23:59'}`),
                color: app.status === 'Realizada' ? 'bg-green-500' : 'bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700'
            });
        });

        activities.forEach(act => {
            events.push({
                id: `activity-${act.id}`,
                type: 'activity',
                originalData: act,
                title: act.topic,
                startDate: new Date(`${act.date}T00:00:00`),
                endDate: new Date(`${act.endDate || act.date}T23:59:59`),
                color: 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700'
            });
        });

        casesWithFollowUp.forEach(c => {
            const studentName = studentMap.get(c.studentId) || 'N/A';
            events.push({
                id: `followup-${c.id}`,
                type: 'followup',
                originalData: {...c, studentName},
                title: `Seguimiento: ${studentName}`,
                startDate: new Date(`${c.dueDate}T00:00:00`),
                endDate: new Date(`${c.dueDate}T23:59:59`),
                color: 'bg-yellow-500 hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-700'
            });
        });
        
        return { events, allPeople };
    }, [currentDate]);

    // --- Calendar Grid Logic ---
    const { monthGrid, monthName, year } = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);

        const monthGrid: (Date | null)[] = [];
        
        // Adjust start day to be Monday (1) instead of Sunday (0)
        let dayOfWeek = firstDayOfMonth.getDay();
        if (dayOfWeek === 0) dayOfWeek = 7; 
        dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;


        // Add blank days for the previous month
        for (let i = 0; i < dayOfWeek; i++) {
            monthGrid.push(null);
        }

        // Add days of the current month
        for (let day = 1; day <= lastDayOfMonth.getDate(); day++) {
            monthGrid.push(new Date(year, month, day));
        }
        
        const monthName = currentDate.toLocaleDateString('es-ES', { month: 'long' });
        return { monthGrid, monthName: monthName.charAt(0).toUpperCase() + monthName.slice(1), year };
    }, [currentDate]);

    // --- Event Logic ---
    const getEventsForDay = useCallback((day: Date) => {
        if (!data?.events) return [];
        return data.events.filter(event => {
            const eventStart = new Date(event.startDate.toDateString());
            const eventEnd = new Date(event.endDate.toDateString());
            const currentDay = new Date(day.toDateString());

            if (event.type === 'activity' && (currentDay.getDay() === 6 || currentDay.getDay() === 0)) {
                return false; // Exclude activities on weekends
            }
            return currentDay >= eventStart && currentDay <= eventEnd;
        }).sort((a,b) => a.startDate.getTime() - b.startDate.getTime());
    }, [data?.events]);

    // --- Handlers ---
    const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    
    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const endX = e.changedTouches[0].clientX;
        const deltaX = endX - touchStartRef.current.x;
        if (Math.abs(deltaX) > 50) { // Swipe threshold
            if (deltaX > 0) handlePrevMonth();
            else handleNextMonth();
        }
        touchStartRef.current = null;
    };
    
    const isPastDay = (day: Date) => {
        const today = new Date();
        today.setHours(0,0,0,0);
        return day < today;
    }
    
    const handleDayClick = (day: Date) => {
        setSelectedDate(day);
    };
    
    const handleEventClick = (event: DisplayEvent) => {
        setSelectedEvent({type: event.type, data: event.originalData} as CalendarEvent);
        if(event.type === 'followup') {
            const originalCase = event.originalData as CaseFile;
            setModal(`case-detail-${originalCase.id}`);
        } else {
            setModal('event-detail');
        }
    };
    
    const handleGenerateDailySchedule = async () => {
        if (!selectedDate || !data?.events) return;
        const appointments = data.events
            .filter(e => e.type === 'appointment' && new Date(e.startDate.toDateString()).getTime() === new Date(selectedDate.toDateString()).getTime())
            .map(e => e.originalData as Appointment);
        
        const peopleMap = new Map();
        [...data.allPeople.students, ...data.allPeople.representatives, ...data.allPeople.teachers].forEach(p => peopleMap.set(p.id, p.fullName));

        const appointmentsWithNames = appointments.map(app => ({...app, attendeeName: peopleMap.get(app.attendeeId) || 'N/A'}));

        await PdfGenerator.generateDailySchedulePdf(selectedDate, appointmentsWithNames);
    };

    const handleExportPlan = async (period: 'semana' | 'mes' | 'trimestre' | 'año') => {
        if (!data?.events) return;
        const today = new Date(currentDate);
        let startDate: Date;
        let endDate: Date;
        let periodLabel = '';

        switch(period) {
            case 'semana':
                const dayOfWeek = today.getDay();
                const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                startDate = new Date(today.setDate(diff));
                endDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 6);
                periodLabel = `Semana del ${Utils.formatDate(startDate)}`;
                break;
            case 'mes':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1);
                endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                periodLabel = `${monthName} ${year}`;
                break;
            case 'trimestre':
                const quarter = Math.floor(today.getMonth() / 3);
                startDate = new Date(today.getFullYear(), quarter * 3, 1);
                endDate = new Date(today.getFullYear(), quarter * 3 + 3, 0);
                periodLabel = `Trimestre ${quarter + 1} de ${year}`;
                break;
            case 'año':
                startDate = new Date(today.getFullYear(), 0, 1);
                endDate = new Date(today.getFullYear(), 11, 31);
                periodLabel = `Año ${year}`;
                break;
        }

        const activities = data.events
            .filter(e => e.type === 'activity' && e.startDate >= startDate && e.startDate <= endDate)
            .map(e => e.originalData as PreventiveActivity);
        
        await PdfGenerator.generateActivityReportPdf(activities, periodLabel);
        setModal(null);
    };

    const isActionDisabled = !selectedDate || isPastDay(selectedDate);
    const isActivityPlanningDisabled = !selectedDate || isPastDay(selectedDate) || selectedDate.getDay() === 0 || selectedDate.getDay() === 6;
    const today = new Date();
    
    // --- Render ---
    return (
        <div>
            <h1 className="text-3xl font-bold text-dece-blue-800 dark:text-dece-blue-200 mb-6">Calendario de Actividades</h1>
            <Card>
                {/* Header and Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4 p-2 border-b dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                        <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronLeft /></button>
                        <h2 className="text-xl font-semibold w-40 text-center">{monthName} {year}</h2>
                        <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"><ChevronRight /></button>
                    </div>
                    <div className="flex flex-wrap justify-center gap-2 mt-4 sm:mt-0">
                        <button onClick={() => setModal('appointment')} disabled={isActionDisabled} className="btn-primary text-sm px-3 py-1.5"><PlusCircle size={16} className="mr-1"/> Agendar Cita</button>
                        <button onClick={() => setModal('activity')} disabled={isActivityPlanningDisabled} className="btn-primary text-sm px-3 py-1.5"><PlusCircle size={16} className="mr-1"/> Planificar Actividad</button>
                        <button onClick={handleGenerateDailySchedule} disabled={!selectedDate} className="btn-secondary text-sm px-3 py-1.5"><FileText size={16} className="mr-1"/> Agenda del Día</button>
                        <button onClick={() => setModal('export-plan')} className="btn-secondary text-sm px-3 py-1.5"><FileDown size={16} className="mr-1"/> Exportar Plan</button>
                    </div>
                </div>

                {/* Calendar Grid */}
                <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
                    <div className="grid grid-cols-7 gap-px text-center text-sm font-semibold bg-gray-200 dark:bg-gray-700">
                        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(day => <div key={day} className="py-2 bg-white dark:bg-gray-800">{day}</div>)}
                    </div>
                    <div className="grid grid-cols-7 grid-rows-6 gap-px bg-gray-200 dark:bg-gray-700">
                        {monthGrid.map((day, index) => {
                            if (!day) return <div key={`empty-${index}`} className="bg-gray-50 dark:bg-gray-800/50"></div>;
                            const isToday = day.toDateString() === today.toDateString();
                            const isSelected = selectedDate?.toDateString() === day.toDateString();
                            const isPast = isPastDay(day);
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            const dayEvents = getEventsForDay(day);

                            const cellClasses = `relative p-2 h-32 overflow-hidden flex flex-col transition-colors
                                ${isPast || isWeekend ? 'bg-gray-100 dark:bg-gray-800/50 text-gray-400' : 'bg-white dark:bg-gray-800 hover:bg-dece-blue-50 dark:hover:bg-dece-blue-900/30 cursor-pointer'}
                                ${isSelected && !isPast && !isWeekend ? 'bg-dece-blue-100 dark:bg-dece-blue-900 ring-2 ring-dece-blue-500' : ''}`;
                            
                            return (
                                <div key={day.toISOString()} className={cellClasses} onClick={() => handleDayClick(day)}>
                                    <span className={`absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-full text-xs
                                        ${isToday ? 'bg-dece-blue-500 text-white font-bold' : ''}`}>
                                        {day.getDate()}
                                    </span>
                                    <div className="mt-6 space-y-1 overflow-y-auto pr-1">
                                        {dayEvents.map(event => (
                                            <div key={event.id} onClick={(e) => { e.stopPropagation(); handleEventClick(event); }}
                                                className={`text-white text-xs p-1 rounded-md truncate ${event.color} cursor-pointer`}>
                                                {event.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Card>

            {/* --- Modals --- */}
            { modal === 'appointment' && <AppointmentModal isOpen={true} onClose={() => setModal(null)} selectedDate={selectedDate!} people={data?.allPeople} onSave={(newApp) => { setLastAppointment(newApp); setSuccessModalOpen(true); setModal(null); }} />}
            { modal === 'activity' && <ActivityModal isOpen={true} onClose={() => setModal(null)} selectedDate={selectedDate!} />}
            { modal === 'event-detail' && <EventDetailModal isOpen={true} onClose={() => setModal(null)} event={selectedEvent} currentUser={currentUser} />}
            { modal?.startsWith('case-detail-') && <CaseDetailModal isOpen={true} onClose={() => setModal(null)} caseId={Number(modal.split('-')[2])} currentUser={currentUser} />}
            { modal === 'export-plan' && <ExportPlanModal isOpen={true} onClose={() => setModal(null)} onExport={handleExportPlan} />}
            { isSuccessModalOpen && lastAppointment && <SuccessModal isOpen={true} onClose={() => setSuccessModalOpen(false)} appointment={lastAppointment} /> }
        </div>
    );
};

export default CalendarPage;