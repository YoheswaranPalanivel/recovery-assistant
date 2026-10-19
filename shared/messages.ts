/**
 * APPROVED MESSAGES. Everything a patient reads about their health comes from this list, never from AI
 * and never from machine translation. Numbers (readings, limits, minutes, times) are passed in as data
 * and inserted as digits, so a translation can never change a number or a dose.
 *
 * Status: the Tamil, Hindi, Telugu and Malayalam texts are drafts. Before real use, each one is checked by a clinician and
 * a native speaker, and the reviewer and date are recorded here.
 */
export const LANGS = ["English", "Tamil", "Hindi", "Telugu", "Malayalam"] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAME: Record<Lang, string> = { English: "English", Tamil: "தமிழ்", Hindi: "हिन्दी", Telugu: "తెలుగు", Malayalam: "മലയാളം" };

type Text = Record<Lang, string>;
export type Review = { status: "draft" | "approved"; reviewer: string | null; date: string | null };
const DRAFT: Review = { status: "draft", reviewer: null, date: null };

export const TEMPLATES = {
  glucose_low_patient: {
    audience: "patient",
    text: {
      English: "Your blood sugar is {mgdl} mg/dL, below the level your doctor set ({low}). Follow the low-sugar steps your doctor gave you. Your health worker can see this reading.",
      Tamil: "உங்கள் இரத்த சர்க்கரை {mgdl} mg/dL. இது உங்கள் மருத்துவர் நிர்ணயித்த அளவை ({low}) விட குறைவு. குறைந்த சர்க்கரைக்கு மருத்துவர் சொன்ன வழிமுறைகளைப் பின்பற்றுங்கள். உங்கள் சுகாதார பணியாளர் இதைப் பார்க்க முடியும்.",
      Hindi: "आपकी रक्त शर्करा {mgdl} mg/dL है, जो आपके डॉक्टर द्वारा तय सीमा ({low}) से कम है। कम शुगर के लिए डॉक्टर के बताए कदम अपनाएँ। आपका स्वास्थ्य कार्यकर्ता यह रीडिंग देख सकता है।",
      Telugu: "మీ రక్తంలో చక్కెర {mgdl} mg/dL. ఇది మీ డాక్టర్ నిర్ణయించిన స్థాయి ({low}) కంటే తక్కువ. తక్కువ చక్కెరకు డాక్టర్ చెప్పిన చర్యలు పాటించండి. మీ ఆరోగ్య కార్యకర్త ఈ రీడింగ్‌ను చూడగలరు.",
      Malayalam: "നിങ്ങളുടെ രക്തത്തിലെ പഞ്ചസാര {mgdl} mg/dL ആണ്. ഇത് ഡോക്ടർ നിശ്ചയിച്ച അളവിനെക്കാൾ ({low}) കുറവാണ്. കുറഞ്ഞ പഞ്ചസാരയ്ക്ക് ഡോക്ടർ പറഞ്ഞ നടപടികൾ പാലിക്കുക. നിങ്ങളുടെ ആരോഗ്യ പ്രവർത്തകന് ഈ റീഡിംഗ് കാണാൻ കഴിയും.",
    },
    review: DRAFT,
  },
  glucose_high_patient: {
    audience: "patient",
    text: {
      English: "Your blood sugar is {mgdl} mg/dL, above the level your doctor set ({high}). Follow your care plan, and tell your health worker if you feel unwell.",
      Tamil: "உங்கள் இரத்த சர்க்கரை {mgdl} mg/dL. இது உங்கள் மருத்துவர் நிர்ணயித்த அளவை ({high}) விட அதிகம். உங்கள் பராமரிப்புத் திட்டத்தைப் பின்பற்றுங்கள்; உடல்நிலை சரியில்லை என்றால் சுகாதார பணியாளரிடம் சொல்லுங்கள்.",
      Hindi: "आपकी रक्त शर्करा {mgdl} mg/dL है, जो आपके डॉक्टर द्वारा तय सीमा ({high}) से अधिक है। अपनी देखभाल योजना का पालन करें, और तबीयत ठीक न लगे तो स्वास्थ्य कार्यकर्ता को बताएँ।",
      Telugu: "మీ రక్తంలో చక్కెర {mgdl} mg/dL. ఇది మీ డాక్టర్ నిర్ణయించిన స్థాయి ({high}) కంటే ఎక్కువ. మీ సంరక్షణ ప్రణాళికను పాటించండి, ఒంట్లో బాగోలేకపోతే మీ ఆరోగ్య కార్యకర్తకు చెప్పండి.",
      Malayalam: "നിങ്ങളുടെ രക്തത്തിലെ പഞ്ചസാര {mgdl} mg/dL ആണ്. ഇത് ഡോക്ടർ നിശ്ചയിച്ച അളവിനെക്കാൾ ({high}) കൂടുതലാണ്. നിങ്ങളുടെ പരിചരണ പദ്ധതി പാലിക്കുക, സുഖമില്ലെങ്കിൽ ആരോഗ്യ പ്രവർത്തകനെ അറിയിക്കുക.",
    },
    review: DRAFT,
  },
  glucose_in_range_patient: {
    audience: "patient",
    text: {
      English: "Your blood sugar is {mgdl} mg/dL, within the range your doctor set. Well done.",
      Tamil: "உங்கள் இரத்த சர்க்கரை {mgdl} mg/dL, மருத்துவர் நிர்ணயித்த அளவுக்குள் உள்ளது. நன்று!",
      Hindi: "आपकी रक्त शर्करा {mgdl} mg/dL है, जो डॉक्टर द्वारा तय सीमा के भीतर है। बहुत अच्छा।",
      Telugu: "మీ రక్తంలో చక్కెర {mgdl} mg/dL, డాక్టర్ నిర్ణయించిన పరిధిలో ఉంది. చాలా బాగుంది.",
      Malayalam: "നിങ്ങളുടെ രക്തത്തിലെ പഞ്ചസാര {mgdl} mg/dL ആണ്, ഡോക്ടർ നിശ്ചയിച്ച പരിധിക്കുള്ളിലാണ്. നന്നായി.",
    },
    review: DRAFT,
  },
  glucose_staff: {
    audience: "staff and family",
    text: {
      English: "Blood sugar {mgdl} mg/dL · {band} (levels {low} to {high}) · {kind} · {time}",
      Tamil: "இரத்த சர்க்கரை {mgdl} mg/dL · {band} (அளவு {low} முதல் {high}) · {kind} · {time}",
      Hindi: "रक्त शर्करा {mgdl} mg/dL · {band} (सीमा {low} से {high}) · {kind} · {time}",
      Telugu: "రక్తంలో చక్కెర {mgdl} mg/dL · {band} (స్థాయిలు {low} నుండి {high}) · {kind} · {time}",
      Malayalam: "രക്തത്തിലെ പഞ്ചസാര {mgdl} mg/dL · {band} (അളവ് {low} മുതൽ {high} വരെ) · {kind} · {time}",
    },
    review: DRAFT,
  },
  plan_line: {
    audience: "patient",
    text: {
      English: "{activity}, {minutes} minutes, on {days} days",
      Tamil: "{activity}, {minutes} நிமிடம், {days} நாட்கள்",
      Hindi: "{activity}, {minutes} मिनट, {days} दिन",
      Telugu: "{activity}, {minutes} నిమిషాలు, {days} రోజులు",
      Malayalam: "{activity}, {minutes} മിനിറ്റ്, {days} ദിവസം",
    },
    review: DRAFT,
  },
  plan_patient: {
    audience: "patient",
    text: {
      English: "This week: {lines}. Small steps make a big difference.",
      Tamil: "இந்த வாரம்: {lines}. சின்ன முயற்சிகள் பெரிய மாற்றம் தரும்.",
      Hindi: "इस सप्ताह: {lines}। छोटे कदम बड़ा फ़र्क लाते हैं।",
      Telugu: "ఈ వారం: {lines}. చిన్న అడుగులే పెద్ద మార్పు తెస్తాయి.",
      Malayalam: "ഈ ആഴ്ച: {lines}. ചെറിയ ചുവടുകൾ വലിയ മാറ്റം ഉണ്ടാക്കും.",
    },
    review: DRAFT,
  },
  medicine_reminder: {
    audience: "patient",
    text: {
      English: "Time for your medicine, exactly as your doctor prescribed.",
      Tamil: "மருந்து நேரம். உங்கள் மருத்துவர் எழுதியபடியே எடுத்துக்கொள்ளுங்கள்.",
      Hindi: "दवा का समय। ठीक वैसे ही लें जैसा डॉक्टर ने लिखा है।",
      Telugu: "మందుల సమయం. డాక్టర్ రాసినట్లే తీసుకోండి.",
      Malayalam: "മരുന്നിന്റെ സമയം. ഡോക്ടർ എഴുതിയതുപോലെ തന്നെ കഴിക്കുക.",
    },
    review: DRAFT,
  },
} satisfies Record<string, { audience: string; text: Text; review: Review }>;
export type MessageKey = keyof typeof TEMPLATES;

/** Approved words used inside messages: reading bands, reading times, activities. */
export const LABELS = {
  band: {
    low: { English: "Low", Tamil: "குறைவு", Hindi: "कम", Telugu: "తక్కువ", Malayalam: "കുറവ്" },
    in_range: { English: "In range", Tamil: "சரியான அளவு", Hindi: "सीमा में", Telugu: "పరిధిలో", Malayalam: "പരിധിയിൽ" },
    high: { English: "High", Tamil: "அதிகம்", Hindi: "अधिक", Telugu: "ఎక్కువ", Malayalam: "കൂടുതൽ" },
  },
  kind: {
    fasting: { English: "Before breakfast", Tamil: "காலை உணவுக்கு முன்", Hindi: "नाश्ते से पहले", Telugu: "అల్పాహారానికి ముందు", Malayalam: "പ്രഭാതഭക്ഷണത്തിന് മുമ്പ്" },
    post_meal: { English: "After a meal", Tamil: "சாப்பிட்ட பின்", Hindi: "खाने के बाद", Telugu: "భోజనం తర్వాత", Malayalam: "ഭക്ഷണത്തിന് ശേഷം" },
    random: { English: "Other time", Tamil: "வேறு நேரம்", Hindi: "अन्य समय", Telugu: "ఇతర సమయం", Malayalam: "മറ്റ് സമയം" },
  },
  activity: {
    brisk_walk: { English: "Brisk walk", Tamil: "வேகமான நடை", Hindi: "तेज़ चाल से टहलना", Telugu: "వేగంగా నడక", Malayalam: "വേഗത്തിലുള്ള നടത്തം" },
    short_walk: { English: "Short walk", Tamil: "சிறு நடை", Hindi: "थोड़ी देर टहलना", Telugu: "కొద్దిసేపు నడక", Malayalam: "ചെറിയ നടത്തം" },
    walk_after_meal: { English: "Walk after a meal", Tamil: "சாப்பாட்டுக்குப் பின் நடை", Hindi: "खाने के बाद टहलना", Telugu: "భోజనం తర్వాత నడక", Malayalam: "ഭക്ഷണശേഷം നടത്തം" },
    yoga: { English: "Gentle yoga", Tamil: "எளிய யோகா", Hindi: "हल्का योग", Telugu: "సులభమైన యోగా", Malayalam: "ലഘു യോഗ" },
    chair_exercises: { English: "Chair exercises", Tamil: "நாற்காலி பயிற்சி", Hindi: "कुर्सी पर व्यायाम", Telugu: "కుర్చీ వ్యాయామాలు", Malayalam: "കസേര വ്യായാമങ്ങൾ" },
    stretching: { English: "Stretching", Tamil: "உடல் நீட்சி பயிற்சி", Hindi: "स्ट्रेचिंग", Telugu: "స్ట్రెచింగ్", Malayalam: "സ്ട്രെച്ചിംഗ്" },
  },
} satisfies Record<string, Record<string, Text>>;

export const asLang = (l: string | null | undefined): Lang => (LANGS.includes(l as Lang) ? (l as Lang) : "English");

/**
 * Fills an approved template. Every placeholder must be given, or this throws: a message with a
 * missing number is never sent. Numbers go in as digits, exactly as given.
 */
export function render(key: MessageKey, lang: Lang, params: Record<string, string | number>): string {
  const tpl = TEMPLATES[key].text[lang];
  return tpl.replace(/\{(\w+)\}/g, (_, name: string) => {
    const v = params[name];
    if (v === undefined || v === null || v === "") throw new Error(`Message ${key}: missing ${name}`);
    return String(v);
  });
}

/** A weekly activity plan in the patient's language, built only from approved words and the plan's numbers. */
export function renderPlan(actions: { activity: string; minutes: number; days: string[] }[], lang: Lang): string {
  const lines = actions.map((a) =>
    render("plan_line", lang, {
      activity: (LABELS.activity as Record<string, Text>)[a.activity]?.[lang] ?? a.activity,
      minutes: a.minutes,
      days: a.days.length,
    }),
  );
  return render("plan_patient", lang, { lines: lines.join("; ") });
}