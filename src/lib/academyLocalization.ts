import type {AcademyLanguage} from "@/hooks/useAcademyTranslations";
export const supportedAcademyLanguages:{code:AcademyLanguage;name:string;locale:string}[]=[
  {code:"en",name:"English",locale:"en-US"},
  {code:"fr",name:"Français",locale:"fr-FR"},
  {code:"es",name:"Español",locale:"es-ES"},
  {code:"pt",name:"Português",locale:"pt-BR"},
];

/** Course labels are navigation aids. Substantive lessons appear in a
 * selected language only when their separate translated text was reviewed.
 */
export const courseLabels:Record<string,Record<AcademyLanguage,string>>={
  start:{en:"Workspace Essentials",fr:"Fondements de l'espace de travail",es:"Fundamentos del espacio de trabajo",pt:"Fundamentos do ambiente de trabalho"},
  hr:{en:"Human Resources & Volunteer Care",fr:"Ressources humaines et bénévolat",es:"Recursos humanos y voluntariado",pt:"Recursos humanos e voluntariado"},
  program:{en:"Programs & NGO Portfolio",fr:"Programmes et portefeuille d'ONG",es:"Programas y cartera de ONG",pt:"Programas e portfólio de ONGs"},
  operations:{en:"Operations & Project Execution",fr:"Opérations et exécution des projets",es:"Operaciones y ejecución de proyectos",pt:"Operações e execução de projetos"},
  technology:{en:"Technology & Information Security",fr:"Technologie et sécurité de l'information",es:"Tecnología y seguridad de la información",pt:"Tecnologia e segurança da informação"},
  administration:{en:"Administration & Executive Secretariat",fr:"Administration et secrétariat exécutif",es:"Administración y secretaría ejecutiva",pt:"Administração e secretaria executiva"},
  compliance:{en:"Governance, Compliance & Risk",fr:"Gouvernance, conformité et risques",es:"Gobernanza, cumplimiento y riesgos",pt:"Governança, conformidade e riscos"},
  improvement:{en:"Efficiency & Innovation",fr:"Efficacité et innovation",es:"Eficiencia e innovación",pt:"Eficiência e inovação"},
  grants:{en:"Development & Grant Writing",fr:"Développement et rédaction de demandes de subvention",es:"Desarrollo y redacción de subvenciones",pt:"Desenvolvimento e elaboração de propostas de subsídios"},
  research:{en:"Research & Source Evidence",fr:"Recherche et preuves documentaires",es:"Investigación y evidencia documental",pt:"Pesquisa e evidências documentais"},
  communications:{en:"Communications & Editorial",fr:"Communication et rédaction",es:"Comunicación y edición",pt:"Comunicação e edição"},
  marketing:{en:"Marketing & Social Media",fr:"Marketing et réseaux sociaux",es:"Mercadotecnia y redes sociales",pt:"Marketing e redes sociais"},
  budget:{en:"Budgeting & Internal Controls",fr:"Budgétisation et contrôles internes",es:"Presupuestos y controles internos",pt:"Orçamento e controles internos"},
  accounting:{en:"Accounting & Reconciliation",fr:"Comptabilité et rapprochement",es:"Contabilidad y conciliación",pt:"Contabilidade e conciliação"},
  board:{en:"Board Governance",fr:"Gouvernance du conseil d'administration",es:"Gobernanza del consejo directivo",pt:"Governança do conselho diretor"},
};
export const languageText:Record<AcademyLanguage,{
  language:string;noTranslation:string;lessonLanguage:string;englishFallback:string;
  reviewedTranslation:string;learningObjectives:string;practiceCheck:string;
}>={
  en:{language:"Instruction language",noTranslation:"This lesson has no independently approved translation in the selected language.",
    lessonLanguage:"Lesson language",englishFallback:"English source shown until a translation is reviewed",
    reviewedTranslation:"Independently reviewed translation",learningObjectives:"Learning objective",practiceCheck:"Practice check"},
  fr:{language:"Langue des instructions",noTranslation:"Aucune traduction approuvée indépendamment n'est disponible pour cette leçon.",
    lessonLanguage:"Langue de la leçon",englishFallback:"Texte anglais affiché en attendant la validation de la traduction",
    reviewedTranslation:"Traduction vérifiée indépendamment",learningObjectives:"Objectif pédagogique",practiceCheck:"Exercice pratique"},
  es:{language:"Idioma de las instrucciones",noTranslation:"Esta lección aún no tiene una traducción revisada de forma independiente.",
    lessonLanguage:"Idioma de la lección",englishFallback:"Se muestra el texto en inglés hasta que se revise la traducción",
    reviewedTranslation:"Traducción revisada de forma independiente",learningObjectives:"Objetivo de aprendizaje",practiceCheck:"Práctica"},
  pt:{language:"Idioma das instruções",noTranslation:"Esta lição ainda não possui tradução aprovada por um revisor independente.",
    lessonLanguage:"Idioma da lição",englishFallback:"O texto em inglês será exibido até que a tradução seja revisada",
    reviewedTranslation:"Tradução revisada de forma independente",learningObjectives:"Objetivo de aprendizagem",practiceCheck:"Exercício prático"},
};
export const academyLabel=(track:string,language:AcademyLanguage)=>courseLabels[track]?.[language]||courseLabels[track]?.en||track;
