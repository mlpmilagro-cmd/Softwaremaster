import React, { useState, useEffect, ReactNode, FC } from 'react';
import { User } from '../../database';
import { 
    Home, Building, Users, Briefcase, Baby, HeartPulse, Calendar, Megaphone, BarChart2, Settings, 
    Sun, Moon, Menu, X, UsersRound, FileText, FolderOpen, ClipboardList, UserPlus, BookUser,
    ShieldAlert, LogOut, ChevronDown
} from 'lucide-react';

import ErrorBoundary from '../shared/ErrorBoundary';
import DashboardPage from '../../pages/DashboardPage';
import InstitucionPage from '../../pages/InstitucionPage';
import ActorsPage from '../../pages/ActorsPage';
import CasosPage from '../../pages/CasosPage';
import FollowUpsPage from '../../pages/FollowUpsPage';
import AssistedClassesPage from '../../pages/AssistedClassesPage';
import StudentRosterPage from '../../pages/StudentRosterPage';
import ActividadesPage from '../../pages/ActividadesPage';
import EducandoEnFamiliaPage from '../../pages/EducandoEnFamiliaPage';
import CalendarPage from '../../pages/CalendarPage';
import SettingsPage from '../../pages/SettingsPage';
import EmbarazosPage from '../../pages/EmbarazosPage';
import ReportsPage from '../../pages/ReportsPage';
import SexualViolenceCasesPage from '../../pages/SexualViolenceCasesPage';

interface MainLayoutProps {
    currentUser: User;
    onLogout: () => void;
}

const MENU_STRUCTURE = [
    {
        category: 'Principal',
        icon: Home,
        items: ['dashboard', 'agenda', 'reportes']
    },
    {
        category: 'Actores',
        icon: Users,
        items: ['actores', 'student_roster']
    },
    {
        category: 'Casos',
        icon: FolderOpen,
        items: ['casos', 'seguimientos', 'violencia_sexual']
    },
    {
        category: 'Intervenciones',
        icon: HeartPulse,
        items: ['clases_asistidas', 'embarazos', 'actividades', 'educando_en_familia']
    },
    {
        category: 'Administración',
        icon: Settings,
        items: ['institucion', 'configuracion']
    }
];


const MainLayout: FC<MainLayoutProps> = ({ currentUser, onLogout }) => {
    // FIX: Moved the PAGES constant inside the MainLayout component.
    // It was previously in the module scope where `currentUser` was not defined.
    // Moving it inside gives it access to the `currentUser` prop, which is needed by several page components.
    const PAGES: { [key: string]: { component: ReactNode, title: string, icon: React.ElementType } } = {
        dashboard: { component: <DashboardPage />, title: 'Dashboard', icon: Home },
        agenda: { component: <CalendarPage currentUser={currentUser} />, title: 'Calendario', icon: Calendar },
        reportes: { component: <ReportsPage />, title: 'Reportes y Estadísticas', icon: BarChart2 },
        actores: { component: <ActorsPage currentUser={currentUser}/>, title: 'Gestión de Actores', icon: Users },
        student_roster: { component: <StudentRosterPage />, title: 'Base de Estudiantes', icon: FileText },
        casos: { component: <CasosPage currentUser={currentUser} />, title: 'Expedientes de Casos', icon: FolderOpen },
        seguimientos: { component: <FollowUpsPage currentUser={currentUser} />, title: 'Seguimientos', icon: ClipboardList },
        violencia_sexual: { component: <SexualViolenceCasesPage />, title: 'Casos de Violencia Sexual', icon: ShieldAlert },
        clases_asistidas: { component: <AssistedClassesPage currentUser={currentUser} />, title: 'Clases Asistidas', icon: UserPlus },
        embarazos: { component: <EmbarazosPage currentUser={currentUser} />, title: 'Embarazo/Maternidad', icon: Baby },
        actividades: { component: <ActividadesPage />, title: 'Actividades Preventivas', icon: Megaphone },
        educando_en_familia: { component: <EducandoEnFamiliaPage />, title: 'Educando en Familia', icon: BookUser },
        institucion: { component: <InstitucionPage />, title: 'Institución', icon: Building },
        configuracion: { component: <SettingsPage currentUser={currentUser} />, title: 'Configuración', icon: Settings },
    };

    const [currentPage, setCurrentPage] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
        'Principal': true,
    });
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    });

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDarkMode]);

    useEffect(() => {
        const findCategory = () => {
            for (const group of MENU_STRUCTURE) {
                if (group.items.includes(currentPage)) {
                    return group.category;
                }
            }
            return null;
        };

        const activeCategory = findCategory();
        if (activeCategory && !openCategories[activeCategory]) {
            setOpenCategories(prev => ({
                ...prev,
                [activeCategory]: true
            }));
        }
    }, [currentPage]);

    const handleNavigation = (page: string) => {
        setCurrentPage(page);
        if (isSidebarOpen) {
            setIsSidebarOpen(false);
        }
    };
    
    const SidebarContent = () => {
        const toggleCategory = (category: string) => {
            setOpenCategories(prev => ({
                ...prev,
                [category]: !prev[category]
            }));
        };

        return (
            <div className="flex flex-col h-full">
                <div className="p-4 flex items-center justify-center border-b dark:border-gray-700 h-16">
                    <UsersRound size={32} className="text-dece-blue-500 mr-2" />
                    <h1 className="text-xl font-bold text-dece-blue-800 dark:text-dece-blue-200">DECE App</h1>
                </div>
                <nav className="flex-grow p-2 space-y-1 overflow-y-auto">
                    {MENU_STRUCTURE.map((group) => {
                        const Icon = group.icon;
                        const isExpanded = openCategories[group.category];
                        return (
                            <div key={group.category}>
                                <button
                                    onClick={() => toggleCategory(group.category)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                                >
                                    <div className="flex items-center">
                                        <Icon size={20} className="mr-3 text-dece-blue-500" />
                                        <span>{group.category}</span>
                                    </div>
                                    <ChevronDown
                                        size={18}
                                        className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                    />
                                </button>
                                {isExpanded && (
                                    <div className="pt-1 pl-4 space-y-1">
                                        {group.items.map(key => {
                                            const { title, icon: PageIcon } = PAGES[key];
                                            return (
                                                <a
                                                    key={key}
                                                    href="#"
                                                    onClick={(e) => { e.preventDefault(); handleNavigation(key); }}
                                                    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                                        currentPage === key
                                                            ? 'bg-dece-blue-100 text-dece-blue-800 dark:bg-dece-blue-900 dark:text-dece-blue-100'
                                                            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                                                    }`}
                                                >
                                                    <PageIcon size={18} className="mr-3" />
                                                    <span>{title}</span>
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
            <aside className="hidden lg:flex lg:flex-shrink-0">
                <div className="flex flex-col w-64">
                    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-800 border-r dark:border-gray-700">
                        <SidebarContent />
                    </div>
                </div>
            </aside>

            <div className={`fixed inset-0 flex z-40 lg:hidden ${isSidebarOpen ? '' : 'pointer-events-none'}`} role="dialog" aria-modal="true">
                <div className={`fixed inset-0 bg-gray-600 bg-opacity-75 transition-opacity ${isSidebarOpen ? 'ease-in-out duration-300 opacity-100' : 'ease-in-out duration-300 opacity-0'}`} aria-hidden="true" onClick={() => setIsSidebarOpen(false)}></div>
                <div className={`relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-gray-800 transform transition ease-in-out duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <SidebarContent />
                </div>
            </div>

            <div className="flex flex-col w-0 flex-1 overflow-hidden">
                <div className="relative z-10 flex-shrink-0 flex h-16 bg-white dark:bg-gray-800 shadow items-center justify-between px-4">
                    <button type="button" className="lg:hidden px-4 -ml-4 text-gray-500 focus:outline-none" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                       <span className="sr-only">{isSidebarOpen ? 'Cerrar menú' : 'Abrir menú'}</span>
                       {isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                    {/* Spacer to push user menu to the right */}
                    <div className="flex-1"></div>
                    <div className="relative">
                        <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
                            <span className="hidden sm:inline text-sm font-medium">{currentUser.nombreCompleto}</span>
                            <ChevronDown size={16} className="text-gray-500" />
                        </button>
                        {isUserMenuOpen && (
                            <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 focus:outline-none">
                                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                                    <div className="px-4 py-3 border-b dark:border-gray-700">
                                        <p className="text-sm font-medium truncate">{currentUser.nombreCompleto}</p>
                                        <p className="text-xs text-gray-500">{currentUser.rol}</p>
                                    </div>
                                    <button onClick={() => { setIsDarkMode(!isDarkMode); setIsUserMenuOpen(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">
                                        {isDarkMode ? <Sun size={16} className="mr-3"/> : <Moon size={16} className="mr-3"/>}
                                        {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
                                    </button>
                                    <button onClick={onLogout} className="w-full text-left flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700" role="menuitem">
                                        <LogOut size={16} className="mr-3"/>
                                        Cerrar Sesión
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <main className="flex-1 relative overflow-y-auto focus:outline-none">
                    <div className="py-6 px-4 sm:px-6 lg:px-8">
                        <ErrorBoundary>
                           {PAGES[currentPage].component}
                        </ErrorBoundary>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default MainLayout;