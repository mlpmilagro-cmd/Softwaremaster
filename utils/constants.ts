export const CASE_PRIORITIES = ['Baja', 'Media', 'Alta', 'Crítica'];
export const CASE_STATUSES = ['Abierto', 'En proceso', 'Cerrado'];

// Centralized questions for the DECE Follow-up Form for Sexual Violence cases.
// This ensures consistency between the form UI and the PDF generation.
export const DECE_FORM_QUESTIONS = [
    { key: 'q1_hasPlan', text: '1. ¿Existe un plan de acompañamiento y restitución para la víctima?' },
    { key: 'q2_planRemitted', text: '2. ¿Se ha remitido al nivel central el Plan de acompañamiento y restitución?' },
    { key: 'q3_planHasObjective', text: '3. ¿El plan de acompañamiento y restitución posee un objetivo y alcance?' },
    { key: 'q4_hasLegalSupport', text: '4. ¿Ha existido acompañamiento legal hacia la víctima?' },
    { key: 'q5_hasPsychologicalSupport', text: '5. ¿Ha existido acompañamiento psicológico a la víctima?' },
    { key: 'q6_hasFamilyPsychologicalSupport', text: '6. ¿Ha existido acompañamiento psicológico a la familia directa de la víctima?' },
    { key: 'q7_hasCommunityPsychologicalSupport', text: '7. ¿Ha existido acompañamiento psicológico a los afectados indirectos (comunidad educativa)?' },
    { key: 'q8_hasMedicalSupport', text: '8. ¿Ha existido acompañamiento médico a la víctima?' },
    { key: 'q9_hasFamilyMedicalSupport', text: '9. ¿Ha existido acompañamiento médico a la familia directa de la víctima?' },
    { key: 'q10_hasCommunityMedicalSupport', text: '10. ¿Ha existido acompañamiento médico a los afectados indirectos (comunidad educativa)?' },
    { key: 'q11_hasPedagogicalSupport', text: '11. ¿Ha existido acompañamiento pedagógico a la víctima?' },
    { key: 'q12_hasCommunityPedagogicalSupport', text: '12. ¿Ha existido acompañamiento pedagógico a los afectados indirectos (comunidad educativa)?' },
    { key: 'q13_hasInfraestructureMeasures', text: '13. ¿Existen medidas de mejoramiento de infraestructura institucional implementadas?' },
    { key: 'q14_planHasBudget', text: '14. ¿El plan de acompañamiento y restitución para la víctima ha considerado un presupuesto para operar las acciones?' },
    { key: 'q15_planHasCronogram', text: '15. ¿El plan de acompañamiento y restitución posee un cronograma para aplicar las acciones?' },
    { key: 'q18_victimChangedInstitution', text: '18. ¿La víctima solicitó cambio de institución?' },
    { key: 'q20_hasInterventionPlan', text: '20. ¿Existe plan de intervención en la institución educativa?' },
    { key: 'q21_victimInEducationSystem', text: '21. ¿La víctima se encuentra dentro del sistema educativo?' },
    { key: 'q22_deceSupportsInNewInstitution', text: '22. ¿En la institución hay un DECE que acompaña a la víctima para garantizar su permanencia en el sistema educativo?' },
    { key: 'q23_resultedInPregnancy', text: '23. ¿La vulneración derivo en un embarazo de la víctima?' },
];
