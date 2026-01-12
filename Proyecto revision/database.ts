import Dexie, { type Table } from 'dexie';
import bcrypt from 'bcryptjs';

// --- SEED DATA HELPERS ---
const FIRST_NAMES = ["Sofía", "Mateo", "Valentina", "Thiago", "Isabella", "Sebastián", "Camila", "Matías", "Valeria", "Benjamín", "Luciana", "Alejandro", "Mariana", "Samuel", "Gabriela", "Diego", "Daniela", "Leonardo", "Martina", "Adrián", "Ana", "Carlos", "Luis", "María", "José", "Juan", "David", "Emily", "Mía", "Lucas"];
const LAST_NAMES = ["García", "Rodríguez", "Martínez", "Hernández", "López", "González", "Pérez", "Sánchez", "Ramírez", "Torres", "Flores", "Rivera", "Gómez", "Díaz", "Reyes", "Morales", "Ortiz", "Zambrano", "Vera", "Cedeño", "Mendoza", "Macías", "Pincay", "Anchundia", "Intriago", "Alvarado", "Saltos", "Chávez", "Ponce", "Suárez"];

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomDate = (start: Date, end: Date): string => {
    const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
    return date.toISOString().split('T')[0];
};
const createFullName = () => `${getRandomItem(FIRST_NAMES)} ${getRandomItem(LAST_NAMES)} ${getRandomItem(LAST_NAMES)}`;
const createCedula = () => Math.floor(1000000000 + Math.random() * 9000000000).toString().substring(0, 10);
const createPhone = () => `09${Math.floor(10000000 + Math.random() * 90000000)}`;

// TypeScript Interfaces for Data Models

export type UserRole = 'Coordinador' | 'Analista' | 'Profesional DECE';
export type UserStatus = 'Pendiente' | 'Activo';

export interface SecurityQuestion {
    pregunta: string;
    respuestaHash: string;
}

export interface User {
  id?: number;
  nombreCompleto: string;
  cedula: string; // Used as username
  correo: string;
  contrasenaHash: string;
  rol: UserRole;
  estado: UserStatus;
  primerInicio: boolean;
  telefono?: string;
  direccion?: string;
  cargo?: string;
  preguntasSeguridad?: SecurityQuestion[];
}


export interface Institution {
  id?: number;
  name:string;
  amie: string;
  district: string;
  authority: string;
  phone: string;
  email: string;
  address: string;
  schoolYear: string;
  logoBase64?: string;
  coordinacionZonal?: string;
  provincia?: string;
  canton?: string;
  parroquia?: string;
}

export interface Course {
    id?: number;
    name: string;
    parallel: string;
    jornada: 'Matutina' | 'Vespertina' | 'Nocturna';
}

export interface Teacher {
  id?: number;
  fullName: string;
  cedula: string;
  email: string;
  phone: string;
  tutorOfCourseId?: number;
  isTutor?: boolean;
}

export interface Representative {
  id?: number;
  fullName:string;
  cedula: string;
  age: number;
  address: string;
  phone: string;
}

export interface Student {
  id?: number;
  fullName: string;
  cedula: string;
  gender: 'Masculino' | 'Femenino' | 'Otro';
  birthDate: string; // YYYY-MM-DD
  specialCondition?: string;
  specialConditionDocBase64?: string;
  photoBase64?: string;
  course: string;
  parallel: string;
  tutorId?: number;
  representativeId: number;
}

export interface CaseCategoryItem {
  id?: number;
  name: string;
  isProtected?: boolean;
}

export type CasePriority = 'Baja' | 'Media' | 'Alta' | 'Crítica';
export type CaseStatus = 'Abierto' | 'En proceso' | 'Cerrado';

export interface CaseFile {
  id?: number;
  studentId: number;
  code: string;
  category: string; // Changed from CaseCategory type
  priority: CasePriority;
  status: CaseStatus;
  openingDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD for next follow-up
  description: string;
  observations?: string;
  attachments: { name: string; base64: string; type: string }[];
  // For 'Violencia Sexual'
  accompanimentPlanBase64?: string;
}

export interface FollowUp {
  id?: number;
  caseId: number;
  date: string; // YYYY-MM-DD
  description: string;
  responsible: string; // User's name
  interventionType?: 'Individual' | 'Familiar' | 'Grupal' | 'Crisis';
  observations?: string;
  attachment?: { name: string; base64: string; type: string };
  isEffective?: boolean;
  participantType?: ('Estudiante' | 'Representante' | 'Docente' | 'Autoridad')[];
}

export interface AssistedClass {
    id?: number;
    studentId: number;
    reason: string;
    permissionPeriod: string; // e.g., "30 días"
    tentativeReturnDate: string; // YYYY-MM-DD
    authorizationDocBase64?: string;
}

export interface PregnancyCase {
    id?: number;
    studentId: number;
    // New fields
    pregnancyStartDate: string; // YYYY-MM-DD
    estimatedDueDate: string; // YYYY-MM-DD
    healthInstitution?: string;
    healthProfessional?: string;
    isHighRisk: boolean;
    needsAlternativeEducation: boolean;
    alternativeEducationType?: 'assisted' | 'flexible';
    flexibilityDetails?: string;
    birthDate?: string; // YYYY-MM-DD
    maternityLeaveStartDate?: string; // YYYY-MM-DD
    maternityLeaveEndDate?: string; // YYYY-MM-DD
    lactationLeaveStartDate?: string; // YYYY-MM-DD
    lactationLeaveEndDate?: string; // YYYY-MM-DD
    birthCertificateBase64?: string;
    // Kept fields
    isFromViolence: boolean;
    receivesHealthCare: 'Pública' | 'Privada' | 'Ninguna';
    relatedCaseId?: number;
}

export interface Appointment {
  id?: number;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  title: string; // e.g., "Cita con representante de [Estudiante]"
  attendeeId: number; // Student, Representative or Teacher ID
  attendeeType: 'Estudiante' | 'Representante' | 'Docente';
  reason: string;
  type?: string;
  status: 'Programada' | 'Realizada' | 'Cancelada';
  responsibleUserId: number;
  studentId?: number;
  caseId?: number;
}

export interface PreventiveActivity {
    id?: number;
    date: string; // YYYY-MM-DD
    endDate?: string;
    startTime: string; // HH:MM
    endTime: string; // HH:MM
    topic: string;
    description?: string;
    isExecuted?: boolean;
    audience: ('Estudiantes' | 'Padres' | 'Docentes' | 'Autoridades')[];
    cooperatingInstitution?: string;
    attendeesMale: number; // Students
    attendeesFemale: number; // Students
    attendeesParents?: number;
    attendeesTeachers?: number;
    attendeesDirectors?: number;
    results: string;
}

export interface CourseMeetingReport {
    id?: number;
    date: string; // YYYY-MM-DD
    course: string;
    parallel: string;
    attendees: string;
    agenda: string;
    conclusions: string;
    attachmentBase64?: string;
}

export interface PefModule {
    id?: number;
    name: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
}

export interface EducandoEnFamilia {
    id?: number;
    teacherId: number;
    moduleName: string;
    modality: 'Presencial' | 'Virtual';
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    score: number;
    hours: number;
    status: 'Aprobado' | 'No Aprobado';
    criteriaMet: boolean[];
    reportId?: number;
}

export interface PefReport {
    id?: number;
    reportDate: string; // YYYY-MM-DD
}


export interface AppSettings {
    key: string;
    value: any;
}

export interface StudentRoster {
  id?: number;
  cedula: string;
  fullName: string;
  course: string;
  parallel: string;
  representativeCedula: string;
  representativeName: string;
  status: 'Pendiente' | 'Creado';
}

// New Interfaces for Sexual Violence Module
export interface SexualViolenceCaseDetails {
    id?: number;
    caseFileId: number;
    // Responsable
    responsibleName: string;
    responsibleCedula: string;
    responsiblePhone: string;
    responsibleCellPhone: string;
    responsibleEmail: string;
    responsiblePosition: string;
    // Info General
    incidentInstitutionAmie: string;
    incidentInstitutionName: string;
    zone: string;
    district: string;
    province: string;
    canton: string;
    parish: string;
    hasDece: boolean;
    deceProfessionalName?: string;
    rectorName: string;
    rectorPosition: string;
    // Infractor
    infractorDocType?: string;
    infractorCedula?: string;
    infractorFullName: string;
    infractorBirthDate?: string;
    infractorAge?: number;
    infractorSex: string;
    infractorRelationship: string;
    // Identificación del Caso
    districtProcessNumber?: string;
    denunciationDate: string;
    denunciatorRelationship: string;
    incidentDate: string;
    crimeType: string;
    hasFiscaliaDenunciation: boolean;
    fiscaliaDenunciationDate?: string;
    fiscaliaDenunciationNumber?: string;
    fiscaliaCity?: string;
    fiscaliaCrimeType?: string;
    initialObservations?: string;
}

export interface SexualViolenceVictim {
    id?: number;
    svCaseDetailsId: number;
    docType: string;
    cedula: string;
    fullName: string;
    representativeCedula: string;
    representativeName: string;
    sex: string;
    birthDate: string;
    ageAtIncident: number;
    hasDisability: boolean;
    disabilityType?: string;
    educationLevel: string;
}

export interface DeceFollowUpForm {
    id?: number;
    caseFileId: number;
    followUpId: number;
    // Q1-15
    q1_hasPlan: boolean;
    q2_planRemitted: boolean;
    q3_planHasObjective: boolean;
    q4_hasLegalSupport: boolean;
    q5_hasPsychologicalSupport: boolean;
    q6_hasFamilyPsychologicalSupport: boolean;
    q7_hasCommunityPsychologicalSupport: boolean;
    q8_hasMedicalSupport: boolean;
    q9_hasFamilyMedicalSupport: boolean;
    q10_hasCommunityMedicalSupport: boolean;
    q11_hasPedagogicalSupport: boolean;
    q12_hasCommunityPedagogicalSupport: boolean;
    q13_hasInfraestructureMeasures: boolean;
    q14_planHasBudget: boolean;
    q15_planHasCronogram: boolean;
    // Q16-23
    q16_monitorName: string;
    q17_monitorPosition: string;
    q18_victimChangedInstitution: boolean;
    q18a_newAmie?: string;
    q18b_newInstitutionName?: string;
    q18c_newZone?: string;
    q18d_newDistrict?: string;
    q19_psychologicalSupportProvider: string;
    q20_hasInterventionPlan: boolean;
    q21_victimInEducationSystem: boolean;
    q22_deceSupportsInNewInstitution: boolean;
    q23_resultedInPregnancy: boolean;
    // Observaciones
    observations: string;
}

export interface PsychosocialInterview {
  id?: number;
  caseFileId: number;
  interviewType: 'Estudiante' | 'Docente' | 'Representante';
  formData: { [section: string]: { [questionKey: string]: any } };
  completedDate: string; // YYYY-MM-DD
}

export class DeceDB extends Dexie {
  users!: Table<User>;
  institution!: Table<Institution>;
  teachers!: Table<Teacher>;
  representatives!: Table<Representative>;
  students!: Table<Student>;
  caseFiles!: Table<CaseFile>;
  followUps!: Table<FollowUp>;
  assistedClasses!: Table<AssistedClass>;
  pregnancyCases!: Table<PregnancyCase>;
  appointments!: Table<Appointment>;
  preventiveActivities!: Table<PreventiveActivity>;
  courseMeetingReports!: Table<CourseMeetingReport>;
  settings!: Table<AppSettings>;
  courses!: Table<Course>;
  studentRoster!: Table<StudentRoster>;
  caseCategories!: Table<CaseCategoryItem>;
  educandoEnFamilia!: Table<EducandoEnFamilia>;
  pefReports!: Table<PefReport>;
  pefModules!: Table<PefModule>;
  // New Tables for Sexual Violence Module
  sexualViolenceCaseDetails!: Table<SexualViolenceCaseDetails>;
  sexualViolenceVictims!: Table<SexualViolenceVictim>;
  deceFollowUpForms!: Table<DeceFollowUpForm>;
  // New Table for Psychosocial Module
  psychosocialInterviews!: Table<PsychosocialInterview>;

  constructor() {
    super('GestionDeceDB');
    const allTables = {
      users: '++id, &cedula, &correo',
      institution: '++id',
      teachers: '++id, &cedula, fullName, tutorOfCourseId, isTutor',
      representatives: '++id, &cedula, fullName',
      students: '++id, &cedula, representativeId, tutorId, fullName, [course+parallel]',
      caseFiles: '++id, &code, studentId, category, priority, status, dueDate, openingDate',
      followUps: '++id, caseId, date',
      assistedClasses: '++id, studentId, tentativeReturnDate',
      pregnancyCases: '++id, studentId, relatedCaseId, pregnancyStartDate, birthDate',
      appointments: '++id, date, startTime, status, studentId, caseId',
      preventiveActivities: '++id, date, startTime, endDate',
      courseMeetingReports: '++id, date, course, parallel',
      settings: 'key',
      courses: '++id, &[name+parallel+jornada]',
      studentRoster: '++id, &cedula, fullName, status',
      caseCategories: '++id, &name',
      educandoEnFamilia: '++id, teacherId, startDate, reportId',
      pefReports: '++id, reportDate',
      pefModules: '++id, &name, startDate',
      sexualViolenceCaseDetails: '++id, &caseFileId',
      sexualViolenceVictims: '++id, svCaseDetailsId, cedula',
      deceFollowUpForms: '++id, &followUpId, caseFileId',
      psychosocialInterviews: '++id, &[caseFileId+interviewType]',
    };

    // This is the combined schema from all previous versions.
    // Each new version just adds to this.
    (this as Dexie).version(26).stores(allTables);

    // FIX: Cast `this` to `Dexie` to access the `on` method for event handling.
    (this as Dexie).on('populate', (tx) => {
        // This event only triggers once when the database is created.
        this.seedDatabase(tx);
    });
  }

  async seedDatabase(tx: Dexie.Transaction) {
    console.log("Seeding database with initial data...");

    // 1. Case Categories
    const categoriesToSeed: Omit<CaseCategoryItem, 'id'>[] = [
        { name: 'Dificultades de aprendizaje' },
        { name: 'Problemas de comportamiento' },
        { name: 'Necesidades Educativas Especiales' },
        { name: 'Violencia Física', isProtected: true },
        { name: 'Violencia Psicológica', isProtected: true },
        { name: 'Violencia Sexual', isProtected: true },
        { name: 'Acoso Escolar (Bullying)', isProtected: true },
        { name: 'Consumo de alcohol, tabaco y/o drogas', isProtected: true },
        { name: 'Situación de vulnerabilidad económica' },
        { name: 'Conflictos familiares' },
        { name: 'Embarazo/ maternidad/ paternidad adolescente' },
        { name: 'Ideación/Intento de suicidio', isProtected: true },
        { name: 'Uso problemático de internet/redes sociales' },
        { name: 'Ausentismo y/o deserción escolar' },
        { name: 'Otros' },
    ];
    const categoryIds = await tx.table('caseCategories').bulkAdd(categoriesToSeed, { allKeys: true });
    const seededCategories = await tx.table<CaseCategoryItem>('caseCategories').toArray();

    // 2. Institution
    await tx.table('institution').add({
        id: 1,
        name: 'Unidad Educativa Fiscal "Simón Bolívar"',
        amie: '09H00001',
        district: '09D01',
        authority: 'MSc. Elena Rodríguez',
        phone: '042123456',
        email: 'info@simonbolivar.edu.ec',
        address: 'Av. 9 de Octubre y Boyacá',
        schoolYear: '2024-2025',
        coordinacionZonal: 'ZONA 8',
        provincia: 'GUAYAS',
        canton: 'GUAYAQUIL',
        parroquia: 'ROCAFUERTE',
    });

    // 3. Users
    const salt = bcrypt.genSaltSync(10);
    await tx.table('users').bulkAdd([
        {
            nombreCompleto: 'Coordinador DECE Principal',
            cedula: '0999999999',
            correo: 'coordinador@dece.com',
            contrasenaHash: bcrypt.hashSync('dece2024', salt),
            rol: 'Coordinador',
            estado: 'Activo',
            primerInicio: false,
            telefono: createPhone(),
            cargo: 'Coordinador/a del DECE',
            preguntasSeguridad: [
                { pregunta: '¿Cuál es el nombre de su primera mascota?', respuestaHash: bcrypt.hashSync('firulais', salt) },
                { pregunta: '¿En qué ciudad nació?', respuestaHash: bcrypt.hashSync('guayaquil', salt) }
            ]
        },
        {
            nombreCompleto: 'Analista DECE',
            cedula: '0988888888',
            correo: 'analista@dece.com',
            contrasenaHash: bcrypt.hashSync('dece2024', salt),
            rol: 'Analista',
            estado: 'Activo',
            primerInicio: false,
        },
        {
            nombreCompleto: 'Profesional DECE',
            cedula: '0977777777',
            correo: 'profesional@dece.com',
            contrasenaHash: bcrypt.hashSync('dece2024', salt),
            rol: 'Profesional DECE',
            estado: 'Pendiente',
            primerInicio: true,
        },
    ]);
    const users = await tx.table<User>('users').toArray();

    // 4. Courses
    const coursesToSeed: Omit<Course, 'id'>[] = [];
    const levels = ['OCTAVO EGB', 'NOVENO EGB', 'DÉCIMO EGB', 'PRIMERO BGU', 'SEGUNDO BGU', 'TERCERO BGU'];
    const parallels = ['A', 'B', 'C'];
    levels.forEach(level => {
        parallels.forEach(parallel => {
            coursesToSeed.push({ name: level, parallel, jornada: 'Matutina' });
        });
    });
    const courseIds = await tx.table('courses').bulkAdd(coursesToSeed, { allKeys: true });
    const seededCourses = await tx.table<Course>('courses').toArray();

    // 5. Teachers
    const teachersToSeed: Omit<Teacher, 'id'>[] = [];
    for (let i = 0; i < 25; i++) {
        teachersToSeed.push({
            fullName: createFullName(),
            cedula: createCedula(),
            email: `docente${i}@simonbolivar.edu.ec`,
            phone: createPhone(),
            isTutor: false,
        });
    }
    const teacherIds = await tx.table('teachers').bulkAdd(teachersToSeed, { allKeys: true });
    // Assign tutors
    for (let i = 0; i < seededCourses.length; i++) {
        if (i < teacherIds.length) {
            await tx.table('teachers').update(teacherIds[i], { isTutor: true, tutorOfCourseId: seededCourses[i].id });
        }
    }
    const seededTeachers = await tx.table<Teacher>('teachers').toArray();

    // 6. Representatives
    const representativesToSeed: Omit<Representative, 'id'>[] = [];
    for (let i = 0; i < 150; i++) {
        representativesToSeed.push({
            fullName: createFullName(),
            cedula: createCedula(),
            age: Math.floor(28 + Math.random() * 30),
            address: `Dirección de prueba ${i + 1}`,
            phone: createPhone(),
        });
    }
    const representativeIds = await tx.table('representatives').bulkAdd(representativesToSeed, { allKeys: true });
    const seededRepresentatives = await tx.table<Representative>('representatives').toArray();

    // 7. Students
    const studentsToSeed: Omit<Student, 'id'>[] = [];
    for (let i = 0; i < 200; i++) {
        const course = getRandomItem(seededCourses) as Course;
        const tutor = seededTeachers.find(t => t.tutorOfCourseId === course.id);
        studentsToSeed.push({
            fullName: createFullName(),
            cedula: createCedula(),
            gender: Math.random() > 0.5 ? 'Masculino' : 'Femenino',
            birthDate: getRandomDate(new Date(2006, 0, 1), new Date(2012, 11, 31)),
            course: course.name,
            parallel: course.parallel,
            tutorId: tutor?.id,
            representativeId: (getRandomItem(seededRepresentatives) as Representative).id!,
            specialCondition: i % 20 === 0 ? 'Dificultad de aprendizaje leve' : undefined
        });
    }
    const studentIds = await tx.table('students').bulkAdd(studentsToSeed, { allKeys: true });
    const seededStudents = await tx.table<Student>('students').toArray();

    // 8. Case Files
    const caseFilesToSeed: Omit<CaseFile, 'id'>[] = [];
    for (let i = 0; i < 50; i++) {
        const student = getRandomItem(seededStudents) as Student;
        const category = getRandomItem(seededCategories) as CaseCategoryItem;
        const openingDate = getRandomDate(new Date(2023, 8, 1), new Date());
        const dueDate = new Date(openingDate);
        dueDate.setDate(dueDate.getDate() + 30);
        caseFilesToSeed.push({
            studentId: student.id!,
            code: `${category.name.substring(0,3).toUpperCase()}-${student.cedula.substring(0,4)}-${i}`,
            category: category.name,
            priority: getRandomItem(['Baja', 'Media', 'Alta', 'Crítica']),
            status: getRandomItem(['Abierto', 'En proceso', 'Cerrado']),
            openingDate: openingDate,
            dueDate: dueDate.toISOString().split('T')[0],
            description: `Descripción inicial del caso sobre ${category.name.toLowerCase()} para el estudiante.`,
            attachments: []
        });
    }
    const caseFileIds = await tx.table('caseFiles').bulkAdd(caseFilesToSeed, { allKeys: true });
    const seededCaseFiles = await tx.table<CaseFile>('caseFiles').toArray();

    // 9. Follow Ups
    const followUpsToSeed: Omit<FollowUp, 'id'>[] = [];
    for (const caseFile of seededCaseFiles) {
        const numFollowUps = Math.floor(1 + Math.random() * 5);
        for (let i = 0; i < numFollowUps; i++) {
            followUpsToSeed.push({
                caseId: caseFile.id!,
                date: getRandomDate(new Date(caseFile.openingDate), new Date()),
                description: `Seguimiento N° ${i + 1} del caso. Se conversó con el estudiante.`,
                responsible: (getRandomItem(users) as User).nombreCompleto,
                isEffective: Math.random() > 0.2,
                participantType: ['Estudiante', 'Representante']
            });
        }
    }
    await tx.table('followUps').bulkAdd(followUpsToSeed);

    // 10. Sexual Violence Cases
    const svCases = seededCaseFiles.filter(c => c.category === 'Violencia Sexual');
    for (const svCase of svCases) {
        const student = seededStudents.find(s => s.id === svCase.studentId);
        const representative = student ? seededRepresentatives.find(r => r.id === student.representativeId) : undefined;
        if (!student) continue;

        const details = {
            caseFileId: svCase.id!,
            responsibleName: users[0].nombreCompleto,
            responsibleCedula: users[0].cedula,
            responsiblePhone: users[0].telefono || createPhone(),
            responsibleCellPhone: users[0].telefono || createPhone(),
            responsibleEmail: users[0].correo,
            responsiblePosition: users[0].cargo || 'Coordinador/a DECE',
            incidentInstitutionAmie: '09H00001',
            incidentInstitutionName: 'Unidad Educativa Fiscal "Simón Bolívar"',
            zone: '8', district: '09D01', province: 'GUAYAS', canton: 'GUAYAQUIL', parish: 'ROCAFUERTE',
            hasDece: true,
            rectorName: 'MSc. Elena Rodríguez', rectorPosition: 'Rectora',
            infractorFullName: createFullName(),
            infractorSex: Math.random() > 0.5 ? 'Masculino' : 'Femenino',
            infractorRelationship: getRandomItem(['Docente', 'Familiar', 'Estudiante', 'Externo']),
            denunciationDate: getRandomDate(new Date(svCase.openingDate), new Date()),
            denunciatorRelationship: 'Representante Legal',
            incidentDate: svCase.openingDate,
            crimeType: getRandomItem(['Abuso Sexual', 'Violación']),
            hasFiscaliaDenunciation: Math.random() > 0.3,
        };
        const detailsId = await tx.table('sexualViolenceCaseDetails').add(details);
        
        await tx.table('sexualViolenceVictims').add({
            svCaseDetailsId: detailsId as number,
            docType: 'CÉDULA',
            cedula: student.cedula,
            fullName: student.fullName,
            representativeCedula: representative?.cedula || '',
            representativeName: representative?.fullName || '',
            sex: student.gender,
            birthDate: student.birthDate,
            ageAtIncident: new Date(details.incidentDate).getFullYear() - new Date(student.birthDate).getFullYear(),
            hasDisability: false,
            educationLevel: student.course,
        });

        const followUpId = await tx.table('followUps').add({
            caseId: svCase.id!, date: new Date().toISOString().split('T')[0], description: "Formulario DECE de V.S. creado.", responsible: users[0].nombreCompleto
        });
        await tx.table('deceFollowUpForms').add({
            caseFileId: svCase.id!,
            followUpId: followUpId as number,
            q1_hasPlan: true, q2_planRemitted: true, q3_planHasObjective: true,
            q4_hasLegalSupport: Math.random() > 0.5, q5_hasPsychologicalSupport: true, q6_hasFamilyPsychologicalSupport: Math.random() > 0.5,
            q7_hasCommunityPsychologicalSupport: false, q8_hasMedicalSupport: true, q9_hasFamilyMedicalSupport: false,
            q10_hasCommunityMedicalSupport: false, q11_hasPedagogicalSupport: true, q12_hasCommunityPedagogicalSupport: false,
            q13_hasInfraestructureMeasures: false, q14_planHasBudget: false, q15_planHasCronogram: true,
            q16_monitorName: users[1].nombreCompleto, q17_monitorPosition: users[1].cargo || 'Analista',
            q18_victimChangedInstitution: false, q19_psychologicalSupportProvider: 'MSP', q20_hasInterventionPlan: true,
            q21_victimInEducationSystem: true, q22_deceSupportsInNewInstitution: true, q23_resultedInPregnancy: false,
            observations: 'Se realiza seguimiento constante al caso.'
        });
    }

    // 11. Pregnancy Cases
    const studentsForPregnancy = seededStudents.filter(s => s.gender === 'Femenino').slice(0, 5);
    for (const student of studentsForPregnancy) {
        const pregnancyStartDate = getRandomDate(new Date(2023, 8, 1), new Date(2024, 2, 1));
        const estimatedDueDate = new Date(pregnancyStartDate);
        estimatedDueDate.setDate(estimatedDueDate.getDate() + 280);
        await tx.table('pregnancyCases').add({
            studentId: student.id!,
            pregnancyStartDate: pregnancyStartDate,
            estimatedDueDate: estimatedDueDate.toISOString().split('T')[0],
            isHighRisk: Math.random() > 0.8,
            needsAlternativeEducation: Math.random() > 0.7,
            isFromViolence: Math.random() > 0.9,
            receivesHealthCare: getRandomItem(['Pública', 'Privada', 'Ninguna']),
        });
    }

    // 12. Assisted Classes
    for(let i = 0; i < 5; i++) {
        await tx.table('assistedClasses').add({
            studentId: (getRandomItem(seededStudents) as Student).id!,
            reason: `Recuperación por procedimiento médico N° ${i+1}`,
            permissionPeriod: '30 días',
            tentativeReturnDate: getRandomDate(new Date(), new Date(2025, 5, 1)),
        });
    }

    // 13. Appointments
    for(let i = 0; i < 30; i++) {
        const attendeeType = getRandomItem(['Estudiante', 'Representante', 'Docente']);
        let attendee: Student | Representative | Teacher;
        if(attendeeType === 'Estudiante') attendee = getRandomItem(seededStudents) as Student;
        else if (attendeeType === 'Representante') attendee = getRandomItem(seededRepresentatives) as Representative;
        else attendee = getRandomItem(seededTeachers) as Teacher;

        await tx.table('appointments').add({
            date: getRandomDate(new Date(), new Date(2025, 5, 1)),
            startTime: `${Math.floor(8 + Math.random() * 8)}:00`,
            endTime: `${Math.floor(9 + Math.random() * 8)}:00`,
            title: `Cita con ${attendee.fullName}`,
            attendeeId: attendee.id!,
            attendeeType: attendeeType as 'Estudiante' | 'Representante' | 'Docente',
            reason: `Seguimiento académico y conductual`,
            status: 'Programada',
            responsibleUserId: users[0].id!,
        });
    }

    // 14. Preventive Activities
    for(let i = 0; i < 15; i++) {
        await tx.table('preventiveActivities').add({
            date: getRandomDate(new Date(2023, 8, 1), new Date()),
            startTime: '10:00', endTime: '11:00',
            topic: `Taller sobre prevención de ${getRandomItem(['bullying', 'drogas', 'violencia'])}`,
            isExecuted: true,
            audience: ['Estudiantes', 'Padres'],
            attendeesMale: Math.floor(20 + Math.random() * 30),
            attendeesFemale: Math.floor(20 + Math.random() * 30),
            results: 'Participación activa de la comunidad.'
        });
    }

    // 15. PEF
    const pefModulesToSeed = [
        { name: "Módulo 1: Convivencia Armónica", startDate: '2024-05-01', endDate: '2024-06-30'},
        { name: "Módulo 2: Prevención de Violencia", startDate: '2024-07-01', endDate: '2024-08-31'},
        { name: "Módulo 3: Uso de Drogas", startDate: '2024-09-01', endDate: '2024-10-31'},
    ];
    await tx.table('pefModules').bulkAdd(pefModulesToSeed);
    for(let i = 0; i < 15; i++) {
        const teacher = getRandomItem(seededTeachers) as Teacher;
        const module = getRandomItem(pefModulesToSeed);
        const score = Math.floor(4 + Math.random() * 5);
        await tx.table('educandoEnFamilia').add({
            teacherId: teacher.id!,
            moduleName: module.name,
            modality: 'Presencial',
            startDate: module.startDate,
            endDate: module.endDate,
            score: score,
            hours: score >= 6 ? 15 : 0,
            status: score >= 6 ? 'Aprobado' : 'No Aprobado',
            criteriaMet: Array(8).fill(true).map((_, j) => j < score),
        });
    }

    console.log("Database seeded successfully.");
  }
}

export const db = new DeceDB();