
import React, { useState, FC, ReactNode } from 'react';
import Modal from '../shared/Modal';
import { Settings, Image, Clock, Building, Users, ArrowRight } from 'lucide-react';

interface OnboardingGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const OnboardingGuideModal: FC<OnboardingGuideModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState(0);

    const onboardingSteps: { title: string; icon: ReactNode; content: ReactNode }[] = [
        {
            title: "¡Bienvenido/a al Sistema de Gestión del DECE!",
            icon: <Settings size={48} className="text-dece-blue-500" />,
            content: (
                <p>
                    Esta guía rápida te ayudará a configurar los aspectos más importantes de la aplicación para que puedas empezar a trabajar.
                    Empecemos por los ajustes iniciales.
                </p>
            )
        },
        {
            title: "Paso 1: Completa tu Entorno de Trabajo",
            icon: <div className="flex gap-2"><Image size={48} className="text-green-500" /><Clock size={48} className="text-yellow-500" /></div>,
            content: (
                <>
                    <p className="mb-2">Ve a la sección de <strong className="text-dece-blue-600 dark:text-dece-blue-300">Configuración</strong> para:</p>
                    <ul className="list-disc list-inside space-y-1 text-left">
                        <li>Subir la imagen de fondo (membrete) que se usará en todos tus documentos PDF.</li>
                        <li>Establecer tu horario laboral para organizar mejor tu agenda de citas.</li>
                        <li>Verificar las categorías de casos y los tiempos de permiso por maternidad/lactancia.</li>
                    </ul>
                </>
            )
        },
        {
            title: "Paso 2: Datos de la Institución",
            icon: <Building size={48} className="text-indigo-500" />,
            content: (
                 <>
                    <p className="mb-2">Visita la sección <strong className="text-dece-blue-600 dark:text-dece-blue-300">Institución</strong>.</p>
                    <p>
                        La información que completes aquí (nombre, AMIE, logo, etc.) aparecerá automáticamente en todos los reportes y documentos que generes, ¡así que asegúrate de que sea correcta!
                    </p>
                </>
            )
        },
        {
            title: "Paso 3: Registro de Actores (¡En Orden!)",
            icon: <Users size={48} className="text-purple-500" />,
            content: (
                <>
                    <p className="mb-2">En la sección <strong className="text-dece-blue-600 dark:text-dece-blue-300">Gestión de Actores</strong>, es muy importante que registres la información en el siguiente orden para mantener la consistencia de los datos:</p>
                    <ol className="list-decimal list-inside space-y-1 text-left font-semibold">
                        <li>Cursos y Paralelos</li>
                        <li>Docentes (y asignarles su tutoría)</li>
                        <li>Representantes Legales (Padres de Familia)</li>
                        <li>Estudiantes (y asignarlos a su curso y representante)</li>
                    </ol>
                </>
            )
        },
        {
            title: "¡Todo Listo!",
            icon: <ArrowRight size={48} className="text-teal-500" />,
            content: (
                <p>
                    Has completado la guía de configuración inicial. Ahora puedes explorar todas las funcionalidades del sistema.
                    ¡Que tengas un excelente trabajo!
                </p>
            )
        }
    ];
    
    const currentStep = onboardingSteps[step];

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Guía de Inicio Rápido" size="lg">
            <div className="text-center p-4">
                <div className="flex items-center justify-center mb-4">
                    {currentStep.icon}
                </div>
                <h3 className="text-xl font-bold mb-2">{currentStep.title}</h3>
                <div className="text-gray-600 dark:text-gray-300 mb-6">
                    {currentStep.content}
                </div>

                <div className="flex justify-between items-center mt-8">
                    <button 
                        onClick={() => setStep(s => s - 1)} 
                        disabled={step === 0}
                        className="btn-secondary"
                    >
                        Anterior
                    </button>
                    <span className="text-sm font-medium text-gray-500">Paso {step + 1} de {onboardingSteps.length}</span>
                    {step < onboardingSteps.length - 1 ? (
                        <button onClick={() => setStep(s => s + 1)} className="btn-primary">
                            Siguiente
                        </button>
                    ) : (
                        <button onClick={onClose} className="btn-primary">
                            Finalizar
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default OnboardingGuideModal;
