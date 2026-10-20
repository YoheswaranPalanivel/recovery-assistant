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
    alert_glucose_low: {
    audience: "staff and family",
    text: {
      English: "Low blood sugar: {mgdl} mg/dL (limit {low}) · {time}",
      Tamil: "குறைந்த சர்க்கரை: {mgdl} mg/dL (அளவு {low}) · {time}",
      Hindi: "कम शुगर: {mgdl} mg/dL (सीमा {low}) · {time}",
      Telugu: "తక్కువ చక్కెర: {mgdl} mg/dL (స్థాయి {low}) · {time}",
      Malayalam: "കുറഞ്ഞ പഞ്ചസാര: {mgdl} mg/dL (പരിധി {low}) · {time}",
    },
    review: DRAFT,
  },
  alert_glucose_high: {
    audience: "staff and family",
    text: {
      English: "High blood sugar: {mgdl} mg/dL (limit {high}) · {time}",
      Tamil: "அதிக சர்க்கரை: {mgdl} mg/dL (அளவு {high}) · {time}",
      Hindi: "अधिक शुगर: {mgdl} mg/dL (सीमा {high}) · {time}",
      Telugu: "ఎక్కువ చక్కెర: {mgdl} mg/dL (స్థాయి {high}) · {time}",
      Malayalam: "കൂടിയ പഞ്ചസാര: {mgdl} mg/dL (പരിധി {high}) · {time}",
    },
    review: DRAFT,
  },
  alert_not_well: {
    audience: "staff and family",
    text: {
      English: "Said they are not feeling well · {time}",
      Tamil: "உடல்நிலை சரியில்லை என்று சொன்னார் · {time}",
      Hindi: "बताया कि तबीयत ठीक नहीं है · {time}",
      Telugu: "ఒంట్లో బాగోలేదని చెప్పారు · {time}",
      Malayalam: "സുഖമില്ലെന്ന് പറഞ്ഞു · {time}",
    },
    review: DRAFT,
  },
  alert_help: {
    audience: "staff and family",
    text: {
      English: "Pressed \"I need help\" · {time}",
      Tamil: "\"உதவி வேண்டும்\" அழுத்தினார் · {time}",
      Hindi: "\"मदद चाहिए\" दबाया · {time}",
      Telugu: "\"సహాయం కావాలి\" నొక్కారు · {time}",
      Malayalam: "\"സഹായം വേണം\" അമർത്തി · {time}",
    },
    review: DRAFT,
  },
  help_sent_patient: {
    audience: "patient",
    text: {
      English: "Your health worker has been told and will contact you soon. In an emergency, call 108.",
      Tamil: "உங்கள் சுகாதார பணியாளருக்குத் தெரிவிக்கப்பட்டது, விரைவில் தொடர்பு கொள்வார். அவசரம் என்றால் 108-ஐ அழைக்கவும்.",
      Hindi: "आपके स्वास्थ्य कार्यकर्ता को बता दिया गया है, वे जल्द संपर्क करेंगे। आपात स्थिति में 108 पर कॉल करें।",
      Telugu: "మీ ఆరోగ్య కార్యకర్తకు తెలియజేశాం, త్వరలో సంప్రదిస్తారు. అత్యవసరమైతే 108కి కాల్ చేయండి.",
      Malayalam: "നിങ്ങളുടെ ആരോഗ്യ പ്രവർത്തകനെ അറിയിച്ചു, ഉടൻ ബന്ധപ്പെടും. അടിയന്തരമാണെങ്കിൽ 108-ൽ വിളിക്കുക.",
    },
    review: DRAFT,
  },
    alert_family_request: {
    audience: "staff and family",
    text: {
      English: "{family} asked for someone to check on them · {time}",
      Tamil: "{family} யாராவது நேரில் பார்க்கக் கேட்டார் · {time}",
      Hindi: "{family} ने किसी को देखने भेजने को कहा · {time}",
      Telugu: "{family} ఎవరైనా వెళ్లి చూడమని అడిగారు · {time}",
      Malayalam: "{family} ആരെങ്കിലും പോയി നോക്കാൻ ആവശ്യപ്പെട്ടു · {time}",
    },
    review: DRAFT,
  },
  fam_waiting: {
    audience: "family",
    text: {
      English: "{helper} has been asked to check on {name}.",
      Tamil: "{name} அவர்களைப் பார்க்க {helper} அவர்களிடம் கேட்கப்பட்டுள்ளது.",
      Hindi: "{name} को देखने के लिए {helper} से कहा गया है।",
      Telugu: "{name}ని చూడమని {helper}ని అడిగాం.",
      Malayalam: "{name}-നെ നോക്കാൻ {helper}-നോട് ആവശ്യപ്പെട്ടു.",
    },
    review: DRAFT,
  },
  fam_on_way: {
    audience: "family",
    text: {
      English: "{helper} is on the way to {name}.",
      Tamil: "{helper} {name} அவர்களிடம் வந்துகொண்டிருக்கிறார்.",
      Hindi: "{helper} {name} के पास जा रहे हैं।",
      Telugu: "{helper} {name} దగ్గరికి వెళ్తున్నారు.",
      Malayalam: "{helper} {name}-ന്റെ അടുത്തേക്ക് പോകുന്നു.",
    },
    review: DRAFT,
  },
  fam_call_now: {
    audience: "family",
    text: {
      English: "No helper has accepted yet. Please call {name} now.",
      Tamil: "இன்னும் உதவியாளர் ஏற்கவில்லை. தயவுசெய்து இப்போதே {name} அவர்களை அழையுங்கள்.",
      Hindi: "अभी तक किसी सहायक ने स्वीकार नहीं किया। कृपया अभी {name} को कॉल करें।",
      Telugu: "ఇంకా ఏ సహాయకుడూ అంగీకరించలేదు. దయచేసి ఇప్పుడే {name}కి కాల్ చేయండి.",
      Malayalam: "ഇതുവരെ ഒരു സഹായിയും സ്വീകരിച്ചിട്ടില്ല. ദയവായി ഇപ്പോൾ തന്നെ {name}-നെ വിളിക്കുക.",
    },
    review: DRAFT,
  },
  fam_emergency: {
    audience: "family",
    text: {
      English: "Nobody has reached {name} yet. If you can't reach them, call the emergency number 108.",
      Tamil: "இன்னும் யாரும் {name} அவர்களை அடையவில்லை. தொடர்பு கொள்ள முடியவில்லை என்றால் அவசர எண் 108-ஐ அழையுங்கள்.",
      Hindi: "अभी तक कोई {name} तक नहीं पहुँचा है। संपर्क न हो पाए तो आपातकालीन नंबर 108 पर कॉल करें।",
      Telugu: "ఇంకా ఎవరూ {name}ని చేరుకోలేదు. సంప్రదించలేకపోతే అత్యవసర నంబర్ 108కి కాల్ చేయండి.",
      Malayalam: "ഇതുവരെ ആരും {name}-നെ എത്തിയിട്ടില്ല. ബന്ധപ്പെടാൻ കഴിയുന്നില്ലെങ്കിൽ അടിയന്തര നമ്പർ 108-ൽ വിളിക്കുക.",
    },
    review: DRAFT,
  },
  fam_all_ok: {
    audience: "family",
    text: {
      English: "No alerts for {name} right now.",
      Tamil: "இப்போது {name} அவர்களுக்கு எந்த எச்சரிக்கையும் இல்லை.",
      Hindi: "अभी {name} के लिए कोई अलर्ट नहीं है।",
      Telugu: "ప్రస్తుతం {name}కి ఎలాంటి హెచ్చరికలు లేవు.",
      Malayalam: "ഇപ്പോൾ {name}-ന് മുന്നറിയിപ്പുകളൊന്നുമില്ല.",
    },
    review: DRAFT,
  },
  fam_ask_button: {
    audience: "family",
    text: {
      English: "Ask someone to check on {name}",
      Tamil: "{name} அவர்களை யாராவது பார்க்கச் சொல்லுங்கள்",
      Hindi: "किसी को {name} को देखने भेजें",
      Telugu: "{name}ని ఎవరైనా చూసేలా అడగండి",
      Malayalam: "{name}-നെ ആരെങ്കിലും പോയി നോക്കാൻ ആവശ്യപ്പെടുക",
    },
    review: DRAFT,
  },
} satisfies Record<string, { audience: string; text: Text; review: Review }>;
export type MessageKey = keyof typeof TEMPLATES;


export const UI = {
  need_help: { English: "I need help", Tamil: "உதவி வேண்டும்", Hindi: "मदद चाहिए", Telugu: "సహాయం కావాలి", Malayalam: "സഹായം വേണം" },
  fam_today: { English: "Right now", Tamil: "இப்போது", Hindi: "अभी", Telugu: "ఇప్పుడు", Malayalam: "ഇപ്പോൾ" },
  fam_latest: { English: "Latest blood sugar", Tamil: "சமீபத்திய சர்க்கரை அளவு", Hindi: "हाल की शुगर रीडिंग", Telugu: "తాజా చక్కెర రీడింగ్", Malayalam: "ഏറ്റവും പുതിയ പഞ്ചസാര നില" },
  fam_checkin: { English: "Today's check-in", Tamil: "இன்றைய பதிவு", Hindi: "आज की जानकारी", Telugu: "ఈరోజు చెక్-ఇన్", Malayalam: "ഇന്നത്തെ ചെക്ക്-ഇൻ" },
  fam_reports: { English: "Visit reports", Tamil: "வருகை அறிக்கைகள்", Hindi: "मुलाक़ात रिपोर्ट", Telugu: "సందర్శన నివేదికలు", Malayalam: "സന്ദർശന റിപ്പോർട്ടുകൾ" },
  fam_not_shared: { English: "Not shared with family", Tamil: "குடும்பத்துடன் பகிரப்படவில்லை", Hindi: "परिवार के साथ साझा नहीं", Telugu: "కుటుంబంతో పంచుకోలేదు", Malayalam: "കുടുംബവുമായി പങ്കിട്ടിട്ടില്ല" },
} satisfies Record<string, Text>;

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

  mood: {
    good: { English: "Feeling good", Tamil: "நல்லா இருக்காங்க", Hindi: "अच्छा महसूस कर रहे हैं", Telugu: "బాగున్నారు", Malayalam: "സുഖമാണ്" },
    okay: { English: "Okay", Tamil: "பரவாயில்லை", Hindi: "ठीक हैं", Telugu: "పరవాలేదు", Malayalam: "കുഴപ്പമില്ല" },
    not_well: { English: "Not feeling well", Tamil: "உடல்நிலை சரியில்லை", Hindi: "तबीयत ठीक नहीं", Telugu: "ఒంట్లో బాగోలేదు", Malayalam: "സുഖമില്ല" },
  },
  check: {
    seen: { English: "Saw the person", Tamil: "நேரில் பார்த்தேன்", Hindi: "व्यक्ति से मिला", Telugu: "వ్యక్తిని చూశాను", Malayalam: "ആളെ നേരിൽ കണ്ടു" },
    talking: { English: "Awake and talking normally", Tamil: "விழிப்புடன், சாதாரணமாக பேசுகிறார்", Hindi: "जागे हुए हैं और सामान्य रूप से बात कर रहे हैं", Telugu: "మెలకువగా ఉన్నారు, మామూలుగా మాట్లాడుతున్నారు", Malayalam: "ഉണർന്നിരിക്കുന്നു, സാധാരണ സംസാരിക്കുന്നു" },
    plan_followed: { English: "Low-sugar steps from their care plan followed", Tamil: "பராமரிப்புத் திட்டத்தின் குறைந்த சர்க்கரை வழிமுறைகள் பின்பற்றப்பட்டன", Hindi: "देखभाल योजना के कम-शुगर कदम अपनाए गए", Telugu: "సంరక్షణ ప్రణాళికలోని తక్కువ చక్కెర చర్యలు పాటించారు", Malayalam: "പരിചരണ പദ്ധതിയിലെ കുറഞ്ഞ പഞ്ചസാര നടപടികൾ പാലിച്ചു" },
    care_team_told: { English: "Care team informed", Tamil: "மருத்துவக் குழுவுக்குத் தெரிவிக்கப்பட்டது", Hindi: "देखभाल टीम को बताया गया", Telugu: "సంరక్షణ బృందానికి తెలియజేశాం", Malayalam: "പരിചരണ സംഘത്തെ അറിയിച്ചു" },
    ambulance: { English: "Ambulance called (108)", Tamil: "ஆம்புலன்ஸ் அழைக்கப்பட்டது (108)", Hindi: "एम्बुलेंस बुलाई गई (108)", Telugu: "అంబులెన్స్ పిలిచాం (108)", Malayalam: "ആംബുലൻസ് വിളിച്ചു (108)" },
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