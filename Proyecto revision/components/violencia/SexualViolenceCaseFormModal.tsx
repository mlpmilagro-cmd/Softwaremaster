import React, { useState, useEffect, FC, useMemo } from 'react';
import type Dexie from 'dexie';
import { db } from '../../database';
import type { Student, Institution, User, SexualViolenceVictim, SexualViolenceCaseDetails, CaseFile, Representative } from '../../database';
import { useLiveQuery } from 'dexie-react-hooks';
import Modal from '../shared/Modal';
import { Plus, Trash2, ChevronRight, ChevronLeft } from 'lucide-react';

const VictimForm: FC<{ onAddVictim: (victim: SexualViolenceVictim) => void, students: Student[], representatives: Representative[] }> = ({ onAddVictim, students, representatives }) => {
    const [victim, setVictim] = useState<Partial<SexualViolenceVictim>>({});
    const [selectedStudentId, setSelectedStudentId] = useState('');

    const handleStudentSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const studentId = e.target.value;
        setSelectedStudentId(studentId);
        const student = students.find(s => s.id === Number(studentId));
        if (student) {
            const representative = representatives.find(r => r.id === student.representativeId);
            setVictim(prev => ({
                ...prev,
                cedula: student.cedula,
                fullName: student.fullName,
                sex: student.gender,
                birthDate: student.birthDate,
                representativeName: representative?.fullName,
                representativeCedula: representative?.cedula,
            }));
        }
    };
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setVictim(prev => ({...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setVictim(prev => ({...prev, [name]: value }));
        }
    };

    const handleAdd = () => {
        // Validation
        if (!victim.fullName || !victim.cedula || !victim.birthDate || !victim.ageAtIncident) {
            alert("Por favor complete todos los campos de la víctima.");
            return;
        }
        onAddVictim(victim as SexualViolenceVictim);
        setVictim({});
        setSelectedStudentId('');
    };

    return (
        <div className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700/50 space-y-3">
             <select value={selectedStudentId} onChange={handleStudentSelect} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600">
                <option value="">O, seleccione un estudiante existente para autocompletar...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input name="fullName" value={victim.fullName || ''} onChange={handleChange} placeholder="Nombres y Apellidos Víctima" className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600" />
                <input name="cedula" value={victim.cedula || ''} onChange={handleChange} placeholder="Cédula Víctima" className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600" />
                <input name="birthDate" value={victim.birthDate || ''} type="date" onChange={handleChange} className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600" />
                <input name="ageAtIncident" value={victim.ageAtIncident || ''} type="number" onChange={handleChange} placeholder="Edad al momento del hecho" className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600" />
                <input name="representativeName" value={victim.representativeName || ''} onChange={handleChange} placeholder="Nombres Representante" className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600" />
                <input name="representativeCedula" value={victim.representativeCedula || ''} onChange={handleChange} placeholder="Cédula Representante" className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600" />
                 <select name="sex" value={victim.sex || ''} onChange={handleChange} className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600">
                    <option value="">Sexo...</option><option value="Masculino">Masculino</option><option value="Femenino">Femenino</option>
                </select>
                <input name="educationLevel" value={victim.educationLevel || ''} onChange={handleChange} placeholder="Nivel de Instrucción" className="p-2 border rounded dark:bg-gray-800 dark:border-gray-600" />
            </div>
            <button type="button" onClick={handleAdd} className="btn-secondary text-sm flex items-center gap-2"><Plus/> Agregar a la lista</button>
        </div>
    );
};


const SexualViolenceCaseFormModal: FC<{ isOpen: boolean; onClose: () => void; }> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState(0);
    const [details, setDetails] = useState<Partial<SexualViolenceCaseDetails>>({});
    const [victims, setVictims] = useState<SexualViolenceVictim[]>([]);

    const data = useLiveQuery(async () => {
        const institution = await db.institution.get(1);
        const user = { name: "Coordinador DECE", cedula: "1234567890", professionalTitle: "Ps. Cl.", email: "dece@example.com", contactNumber: "0991234567" }; // Placeholder
        const students = await db.students.orderBy('fullName').toArray();
        const representatives = await db.representatives.toArray();
        return { institution, user, students, representatives };
    }, []);

    useEffect(() => {
        if (data?.institution && data?.user) {
            setDetails(prev => ({
                ...prev,
                responsibleName: data.user.name,
                responsibleCedula: data.user.cedula,
                responsiblePosition: data.user.professionalTitle,
                responsibleEmail: data.user.email,
                responsiblePhone: data.user.contactNumber,
                incidentInstitutionAmie: data.institution.amie,
                incidentInstitutionName: data.institution.name,
                district: data.institution.district,
                rectorName: data.institution.authority,
            }));
        }
    }, [data]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            setDetails(prev => ({...prev, [name]: (e.target as HTMLInputElement).checked }));
        } else {
            setDetails(prev => ({...prev, [name]: value }));
        }
    };

    const addVictim = (victim: SexualViolenceVictim) => {
        setVictims(prev => [...prev, victim]);
    };
    
    const removeVictim = (index: number) => {
        setVictims(prev => prev.filter((_, i) => i !== index));
    };

    const TABS = ["Responsable", "Info. General", "Infractor", "Identif. del Caso", "Víctimas"];

    const handleSave = async () => {
        if (victims.length === 0) {
            alert("Debe agregar al menos una víctima.");
            return;
        }
        
        try {
            await (db as Dexie).transaction('rw', db.caseFiles, db.sexualViolenceCaseDetails, db.sexualViolenceVictims, db.students, async () => {
                const firstVictimStudent = await db.students.where('cedula').equals(victims[0].cedula).first();
                if (!firstVictimStudent) {
                    throw new Error(`Estudiante con cédula ${victims[0].cedula} no encontrado. Debe crear el actor primero.`);
                }
                
                const today = new Date().toISOString().split('T')[0];
                const caseCode = `VS-${firstVictimStudent.cedula}-${Date.now()}`;

                const caseFileId = await db.caseFiles.add({
                    studentId: firstVictimStudent.id!,
                    code: caseCode,
                    category: 'Violencia Sexual',
                    priority: 'Crítica',
                    status: 'Abierto',
                    openingDate: today,
                    dueDate: details.denunciationDate || today,
                    description: `Caso de Violencia Sexual: ${details.crimeType || 'No especificado'}.`,
                    attachments: [],
                });

                const detailsId = await db.sexualViolenceCaseDetails.add({
                    ...details,
                    caseFileId: caseFileId
                } as SexualViolenceCaseDetails);
                
                await db.sexualViolenceVictims.bulkAdd(victims.map(v => ({...v, svCaseDetailsId: detailsId })));
            });

            alert("Caso de Violencia Sexual registrado con éxito.");
            onClose();

        } catch(error: any) {
            console.error(error);
            alert(`Error al guardar el caso: ${error.message || error}`);
        }
    };
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Formulario para Casos de Violencia Sexual" size="2xl">
            <div className="flex border-b mb-4">
                {TABS.map((tab, index) => (
                    <button key={tab} onClick={() => setActiveTab(index)}
                        className={`py-2 px-4 text-sm font-medium ${activeTab === index ? 'border-b-2 border-dece-blue-500 text-dece-blue-600' : 'text-gray-500'}`}>
                        {index + 1}. {tab}
                    </button>
                ))}
            </div>
            
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                {/* Tab Content */}
                {activeTab === 0 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input name="responsibleName" value={details.responsibleName || ''} onChange={handleChange} placeholder="Nombres del Responsable" readOnly className="p-2 border rounded bg-gray-100 dark:bg-gray-800" />
                    <input name="responsibleCedula" value={details.responsibleCedula || ''} onChange={handleChange} placeholder="Cédula" readOnly className="p-2 border rounded bg-gray-100 dark:bg-gray-800" />
                    <input name="responsiblePosition" value={details.responsiblePosition || ''} onChange={handleChange} placeholder="Cargo" readOnly className="p-2 border rounded bg-gray-100 dark:bg-gray-800" />
                    <input name="responsibleEmail" value={details.responsibleEmail || ''} onChange={handleChange} placeholder="Email" readOnly className="p-2 border rounded bg-gray-100 dark:bg-gray-800" />
                    <input name="responsiblePhone" value={details.responsiblePhone || ''} onChange={handleChange} placeholder="Teléfono" readOnly className="p-2 border rounded bg-gray-100 dark:bg-gray-800" />
                </div>}
                
                {activeTab === 1 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input name="incidentInstitutionName" value={details.incidentInstitutionName || ''} onChange={handleChange} placeholder="Nombre Institución" readOnly className="p-2 border rounded bg-gray-100 dark:bg-gray-800" />
                    <input name="incidentInstitutionAmie" value={details.incidentInstitutionAmie || ''} onChange={handleChange} placeholder="Código AMIE" readOnly className="p-2 border rounded bg-gray-100 dark:bg-gray-800" />
                    <input name="rectorName" value={details.rectorName || ''} onChange={handleChange} placeholder="Nombre Rector/Director" className="p-2 border rounded dark:bg-gray-700" />
                    <input name="rectorPosition" value={details.rectorPosition || ''} onChange={handleChange} placeholder="Cargo Rector/Director" className="p-2 border rounded dark:bg-gray-700" />
                </div>}

                {activeTab === 2 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <input name="infractorFullName" value={details.infractorFullName || ''} onChange={handleChange} placeholder="*Apellidos y Nombres Infractor" className="p-2 border rounded dark:bg-gray-700" />
                    <input name="infractorCedula" value={details.infractorCedula || ''} onChange={handleChange} placeholder="Cédula Infractor" className="p-2 border rounded dark:bg-gray-700" />
                    <input name="infractorBirthDate" value={details.infractorBirthDate || ''} type="date" onChange={handleChange} className="p-2 border rounded dark:bg-gray-700" />
                    <select name="infractorSex" value={details.infractorSex || ''} onChange={handleChange} className="p-2 border rounded dark:bg-gray-700"><option value="">*Sexo...</option><option>Masculino</option><option>Femenino</option></select>
                    <select name="infractorRelationship" value={details.infractorRelationship || ''} onChange={handleChange} className="p-2 border rounded dark:bg-gray-700"><option value="">*Relación con la víctima...</option><option>Docente</option><option>Autoridad</option><option>Familiar</option><option>Estudiante</option><option>Externo</option></select>
                </div>}
                
                {activeTab === 3 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <input name="districtProcessNumber" value={details.districtProcessNumber || ''} onChange={handleChange} placeholder="Número de trámite Distrito" className="p-2 border rounded dark:bg-gray-700" />
                     <input name="denunciationDate" value={details.denunciationDate || ''} type="date" onChange={handleChange} className="p-2 border rounded dark:bg-gray-700" />
                     <input name="denunciatorRelationship" value={details.denunciatorRelationship || ''} onChange={handleChange} placeholder="Quién presenta denuncia?" className="p-2 border rounded dark:bg-gray-700" />
                     <input name="incidentDate" value={details.incidentDate || ''} type="date" onChange={handleChange} className="p-2 border rounded dark:bg-gray-700" />
                     <input name="crimeType" value={details.crimeType || ''} onChange={handleChange} placeholder="Presunta Infracción/Delito" className="p-2 border rounded dark:bg-gray-700" />
                     <label className="flex items-center gap-2"><input type="checkbox" name="hasFiscaliaDenunciation" checked={!!details.hasFiscaliaDenunciation} onChange={handleChange} /> Se presentó denuncia en Fiscalía?</label>
                     {details.hasFiscaliaDenunciation && <>
                        <input name="fiscaliaDenunciationNumber" value={details.fiscaliaDenunciationNumber || ''} onChange={handleChange} placeholder="Nº de denuncia en fiscalía" className="p-2 border rounded dark:bg-gray-700" />
                        <input name="fiscaliaCity" value={details.fiscaliaCity || ''} onChange={handleChange} placeholder="Ciudad de Fiscalía" className="p-2 border rounded dark:bg-gray-700" />
                     </>}
                </div>}
                
                {activeTab === 4 && <div>
                    <h3 className="font-semibold mb-2">Personas Afectadas (Víctimas)</h3>
                    <VictimForm onAddVictim={addVictim} students={data?.students || []} representatives={data?.representatives || []} />
                    <div className="mt-4 space-y-2">
                        {victims.map((v, i) => (
                            <div key={i} className="flex justify-between items-center p-2 bg-white dark:bg-gray-800 rounded-md">
                                <span>{v.fullName} ({v.cedula})</span>
                                <button onClick={() => removeVictim(i)} className="text-red-500"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>}
            </div>

            <div className="flex justify-between pt-4 border-t mt-4">
                <button onClick={() => setActiveTab(p => Math.max(0, p-1))} disabled={activeTab === 0} className="btn-secondary flex items-center gap-2"><ChevronLeft/> Anterior</button>
                {activeTab < TABS.length - 1 && <button onClick={() => setActiveTab(p => Math.min(TABS.length - 1, p+1))} className="btn-secondary flex items-center gap-2">Siguiente <ChevronRight/></button>}
                {activeTab === TABS.length - 1 && <button onClick={handleSave} className="btn-primary">Guardar Caso</button>}
            </div>
        </Modal>
    );
};

export default SexualViolenceCaseFormModal;