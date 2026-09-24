/* Las ~1000 palabras más frecuentes del inglés (basado en listas de frecuencia
   estándar: New General Service List + CEFR A1-B1). Se usan como banco de
   candidatos para las sugerencias: la IA no inventa — elige las más útiles
   para el perfil del usuario desde aquí. */
const TOP1000 = [
  // ── A1 básico ──
  "time","year","people","way","day","man","thing","woman","life","child","world","school","state","family","student",
  "group","country","problem","hand","part","place","case","week","company","system","program","question","work","night",
  "point","home","water","room","mother","area","money","story","fact","month","lot","right","study","book","eye",
  "job","word","business","issue","side","kind","head","house","service","friend","father","power","hour","game","line",
  "end","member","law","car","city","community","name","team","minute","idea","kid","body","information","back","parent",
  "face","others","level","office","door","health","person","art","war","history","party","result","change","morning",
  "reason","research","girl","guy","moment","air","teacher","force","education",
  // ── verbos frecuentes ──
  "be","have","do","say","get","make","go","know","take","see","come","think","look","want","give",
  "use","find","tell","ask","work","seem","feel","try","leave","call","need","become","mean","put","keep",
  "let","begin","help","talk","turn","start","show","hear","play","run","move","like","live","believe","hold",
  "bring","happen","write","sit","stand","lose","pay","meet","include","continue","set","learn","change","lead",
  "understand","watch","follow","stop","create","speak","read","allow","add","spend","grow","open","walk","win","offer",
  "remember","love","consider","appear","buy","wait","serve","die","send","expect","build","stay","fall","cut","reach",
  "kill","remain","suggest","raise","pass","sell","require","report","decide","pull","eat","drink","sleep","cook","clean",
  "wash","drive","ride","swim","dance","sing","draw","paint","teach","study","practice","listen","smile","laugh","cry",
  // ── adjetivos ──
  "good","new","first","last","long","great","little","own","other","old","right","big","high","different","small",
  "large","next","early","young","important","few","public","bad","same","able","best","better","sure","free","full",
  "special","easy","clear","recent","certain","personal","open","red","difficult","available","likely","short","single",
  "happy","sad","angry","tired","hungry","thirsty","sick","healthy","strong","weak","fast","slow","hot","cold","warm",
  "cool","clean","dirty","beautiful","ugly","rich","poor","cheap","expensive","safe","dangerous","busy","free","ready",
  "late","true","false","real","wrong","possible","hard","soft","heavy","light","dark","bright","loud","quiet","empty",
  // ── sustantivos A2 ──
  "food","breakfast","lunch","dinner","meal","bread","rice","meat","fish","chicken","egg","cheese","milk","coffee","tea",
  "juice","fruit","apple","banana","orange","vegetable","salad","soup","sugar","salt","table","chair","bed","sofa","lamp",
  "window","kitchen","bathroom","bedroom","garden","street","road","bridge","park","tree","flower","grass","river","sea",
  "beach","mountain","sun","moon","star","sky","cloud","rain","snow","wind","weather","dog","cat","bird","horse","fish",
  "baby","boy","brother","sister","daughter","son","husband","wife","uncle","aunt","cousin","grandfather","grandmother",
  "doctor","nurse","hospital","medicine","pain","heart","blood","skin","hair","hand","finger","foot","leg","arm","mouth",
  "nose","ear","tooth","voice","song","music","movie","film","picture","photo","camera","phone","computer","screen","key",
  "clothes","shirt","shoe","hat","coat","dress","pants","skirt","bag","box","bottle","cup","plate","knife","fork",
  "spoon","glass","paper","pen","pencil","letter","card","map","ticket","money","price","shop","store","market","bank",
  // ── B1: trabajo, sociedad, opiniones ──
  "meeting","manager","salary","project","client","interview","contract","deadline","task","skill","experience","career",
  "training","success","failure","goal","plan","decision","choice","opinion","advice","behavior","habit","routine","rule",
  "law","safety","risk","cost","value","quality","amount","number","size","shape","color","speed","distance","weight",
  "energy","environment","nature","climate","pollution","technology","internet","website","password","message","email",
  "news","newspaper","article","author","language","sentence","grammar","vocabulary","pronunciation","accent","mistake",
  "exam","test","score","grade","course","lesson","homework","university","college","degree","science","math","subject",
  "relationship","marriage","wedding","birthday","holiday","vacation","trip","journey","flight","airport","hotel","passport",
  "luggage","tourist","culture","tradition","custom","festival","celebration","gift","present","surprise","party","invitation",
  // ── B1: verbos sociales/cognitivos ──
  "agree","disagree","explain","describe","compare","choose","decide","hope","wish","plan","prepare","organize","invite",
  "accept","refuse","cancel","postpone","arrange","promise","apologize","complain","advise","recommend","remind","warn",
  "convince","persuade","impress","surprise","worry","relax","enjoy","prefer","avoid","improve","develop","solve","discover",
  "achieve","fail","compete","win","lose","train","score","practice","exercise","rest","recover","hurt","fix","break",
  "borrow","lend","save","waste","own","share","exchange","return","repeat","check","search","download","upload","connect",
  // ── adverbios/conectores útiles ──
  "always","usually","often","sometimes","rarely","never","already","still","yet","just","almost","quite","rather",
  "probably","possibly","certainly","definitely","immediately","suddenly","finally","recently","currently","usually",
  "however","therefore","although","because","unless","whether","instead","either","neither","both","enough","too",
  // ── emociones/personalidad B1+ ──
  "feeling","emotion","mood","confidence","fear","anger","joy","shame","pride","jealousy","anxiety","stress","calm",
  "patience","honesty","kindness","courage","humor","talent","intelligence","personality","attitude","respect","trust",
  "friendship","loneliness","boredom","excitement","disappointment","satisfaction","embarrassment","curiosity","doubt",
  // ── misceláneos muy útiles ──
  "advice","progress","purpose","reason","result","advantage","disadvantage","opportunity","challenge","solution",
  "attention","memory","dream","imagination","reality","future","past","present","century","decade","audience","public",
  "media","network","account","device","screen","button","link","file","folder","note","list","form","comment","review",
  "forest","desert","island","ocean","lake","hill","valley","coast","path","corner","wall","floor","ceiling","roof"
];

// dedupe + minúsculas por seguridad
export const TOP_WORDS = [...new Set(TOP1000.map((w) => w.toLowerCase()))];
export default TOP1000;
