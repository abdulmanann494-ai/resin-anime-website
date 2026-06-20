const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.RESIN_DATA_DIR
  ? path.resolve(process.env.RESIN_DATA_DIR)
  : path.join(__dirname, 'data');

// Safely ensure data directory exists on boot
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const BCRYPT_ROUNDS = Math.max(10, parseInt(process.env.BCRYPT_ROUNDS || '12', 10));
let generatedDevSeedPassword = null;

function getSeedPassword() {
  if (process.env.RESIN_SEED_PASSWORD || process.env.ADMIN_PASSWORD) {
    return process.env.RESIN_SEED_PASSWORD || process.env.ADMIN_PASSWORD;
  }
  if (process.env.NODE_ENV === 'production') return null;
  if (!generatedDevSeedPassword) {
    generatedDevSeedPassword = crypto.randomBytes(18).toString('base64url');
    console.log(`[DATABASE] Generated one-time local seed password for development: ${generatedDevSeedPassword}`);
  }
  return generatedDevSeedPassword;
}

function legacyPbkdf2Hash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

function isBcryptHash(hash) {
  return typeof hash === 'string' && /^\$2[aby]\$\d{2}\$/.test(hash);
}

function legacyWrappedValue(passwordOrHash, salt, alreadyHashed = false) {
  const legacyHash = alreadyHashed ? passwordOrHash : legacyPbkdf2Hash(passwordOrHash, salt);
  return `legacy-pbkdf2-sha512:${salt}:${legacyHash}`;
}

/**
 * Password hashing uses bcrypt for all new credentials. Legacy PBKDF2 hashes
 * are accepted only for migration on next successful login.
 */
function hashPassword(password) {
  return { salt: null, hash: bcrypt.hashSync(password, BCRYPT_ROUNDS) };
}

function verifyPassword(password, salt, storedHash) {
  if (!password || !storedHash) return false;
  if (isBcryptHash(storedHash)) {
    if (salt) {
      return bcrypt.compareSync(legacyWrappedValue(password, salt), storedHash);
    }
    return bcrypt.compareSync(password, storedHash);
  }
  if (!salt) return false;
  return legacyPbkdf2Hash(password, salt) === storedHash;
}

function needsPasswordRehash(salt, storedHash) {
  return !!salt || !isBcryptHash(storedHash);
}

function wrapLegacyHashForStorage(salt, storedHash) {
  return bcrypt.hashSync(legacyWrappedValue(storedHash, salt, true), BCRYPT_ROUNDS);
}

/**
 * High-performance, zero-dependency, transactional JSON-file-based database store.
 * Implements a temporary-write-and-rename pattern to protect against file corruption.
 */
class LocalJSONStore {
  constructor(filename, defaults) {
    this.filePath = path.join(DATA_DIR, filename);
    this.defaults = defaults;
    this.data = null;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(content);
      } else {
        // Initialize database with default template copies
        this.data = JSON.parse(JSON.stringify(this.defaults));
        this.save();
      }
    } catch (err) {
      console.error(`Error loading database file ${this.filePath}:`, err);
      this.data = JSON.parse(JSON.stringify(this.defaults));
    }
  }

  save() {
    try {
      const tempPath = `${this.filePath}.tmp`;
      const content = JSON.stringify(this.data, null, 2);
      fs.writeFileSync(tempPath, content, 'utf8');
      fs.renameSync(tempPath, this.filePath);
      return true;
    } catch (err) {
      console.error(`Error transactionally writing database file ${this.filePath}:`, err);
      return false;
    }
  }
}

// ==========================================
// PRE-POPULATED DEFAULT DATABASE DATA STORES
// ==========================================

const defaultWallpapers = [
  {
    id: "csm-01",
    title: "Chainsaw Man Neon Slaughter",
    image: "/images/wallpapers/chainsaw_awakening.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 4890,
    favoritesCount: 2310,
    anime: "Chainsaw Man",
    editorial: true,
    rank: 12,
    fileSize: "900 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#120101", "#FF1E2D", "#0A0D14", "#FF8A00", "#E1E1E6"],
    tags: ["#ChainsawMan", "#Denji", "#Neon", "#Cyberpunk", "#DarkAction", "#AnimeWallpaper", "#MappaStyle", "#RedAesthetic", "#4K"],
    artist: "Void_Realm"
  },
  {
    id: "csm-02",
    title: "Bloody Rampage",
    image: "/images/wallpapers/bloody_rampage.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 3950,
    favoritesCount: 1845,
    anime: "Chainsaw Man",
    editorial: false,
    rank: 13,
    fileSize: "986 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#1A0002", "#FF003C", "#FFCC00", "#0B0C10", "#FFFFFF"],
    tags: ["#ChainsawMan", "#Denji", "#Bloody", "#Rampage", "#YellowEyes", "#Action", "#Shonen", "#RedTheme", "#UltraHD"],
    artist: "Studio_Mappa"
  },
  {
    id: "csm-03",
    title: "Makima's Gaze",
    image: "/images/wallpapers/makimas_gaze.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "yellow",
    downloads: 5120,
    favoritesCount: 3105,
    anime: "Chainsaw Man",
    editorial: true,
    rank: 14,
    fileSize: "693 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#1E152A", "#FF7E67", "#F4F1DE", "#3D405B", "#E07A5F"],
    tags: ["#ChainsawMan", "#Makima", "#Gaze", "#Aesthetic", "#ControlDevil", "#Shonen", "#WarmTheme", "#4K"],
    artist: "Void_Realm"
  },
  {
    id: "csm-04",
    title: "Denji Unleashed",
    image: "/images/wallpapers/denji_unleashed.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "yellow",
    downloads: 4100,
    favoritesCount: 1980,
    anime: "Chainsaw Man",
    editorial: false,
    rank: 15,
    fileSize: "1107 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#11151C", "#FFD700", "#FF4500", "#212529", "#F8F9FA"],
    tags: ["#ChainsawMan", "#Denji", "#Unleashed", "#Action", "#YellowTheme", "#Urban", "#Shonen", "#Concrete", "#UltraHD"],
    artist: "Visual_Monarch"
  },
  {
    id: "csm-05",
    title: "Devil Transformation",
    image: "/images/wallpapers/devil_transformation.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 3540,
    favoritesCount: 1670,
    anime: "Chainsaw Man",
    editorial: false,
    rank: 16,
    fileSize: "903 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#050203", "#D90429", "#EF233C", "#8D99AE", "#EDF2F4"],
    tags: ["#ChainsawMan", "#Denji", "#Transformation", "#DevilForm", "#Horror", "#Gore", "#RedTheme", "#DarkAction", "#4K"],
    artist: "Studio_Mappa"
  },
  {
    id: "csm-06",
    title: "Power Unleashed",
    image: "/images/wallpapers/power_unleashed.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 4620,
    favoritesCount: 2280,
    anime: "Chainsaw Man",
    editorial: true,
    rank: 17,
    fileSize: "993 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#1C1D21", "#FF5C5C", "#FFA0A0", "#FFE4E4", "#A29BFE"],
    tags: ["#ChainsawMan", "#Power", "#BloodFiend", "#PinkAesthetic", "#Kawaii", "#Action", "#UltraHD", "#StudioMappa"],
    artist: "Void_Realm"
  },
  {
    id: "csm-07",
    title: "Aerial Assault",
    image: "/images/wallpapers/aerial_assault.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 3290,
    favoritesCount: 1420,
    anime: "Chainsaw Man",
    editorial: false,
    rank: 18,
    fileSize: "935 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#0D1B2A", "#E63946", "#F1FAEE", "#A8DADC", "#457B9D"],
    tags: ["#ChainsawMan", "#AerialAssault", "#MidAir", "#Action", "#BlueSky", "#Crimson", "#4K", "#Shonen"],
    artist: "Visual_Monarch"
  },
  {
    id: "csm-08",
    title: "Darkness Within",
    image: "/images/wallpapers/darkness_within.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "black",
    downloads: 4210,
    favoritesCount: 2190,
    anime: "Chainsaw Man",
    editorial: true,
    rank: 19,
    fileSize: "893 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#0B0C10", "#1F2833", "#C5C6C7", "#66FCF1", "#45A29E"],
    tags: ["#ChainsawMan", "#Aki", "#DarknessWithin", "#Katana", "#Aesthetic", "#TealAesthetic", "#UltraHD", "#MappaStyle"],
    artist: "Void_Realm"
  },
  {
    id: "solo-leveling-arise",
    title: "Shadow Monarch",
    image: "/images/wallpapers/solo_leveling_arise.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "purple",
    downloads: 1240,
    favoritesCount: 520,
    anime: "Anime",
    editorial: true,
    rank: 4,
    fileSize: "819 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#0F0C20", "#8E2DE2", "#4A00E0", "#00E5FF", "#FFFFFF"],
    tags: ["#SoloLeveling", "#SungJinwoo", "#ShadowMonarch", "#PurpleTheme", "#NeonSparks", "#DarkAction", "#Webtoon", "#UltraHD"],
    artist: "Visual_Monarch"
  },
  {
    id: "demon-slayer-hinokami",
    title: "Sun Breathing",
    image: "/images/wallpapers/demon_slayer_hinokami.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "orange",
    downloads: 980,
    favoritesCount: 412,
    anime: "Anime",
    editorial: false,
    rank: 7,
    fileSize: "947 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#1E0A03", "#FF4E00", "#FF8500", "#F9D423", "#FFFFFF"],
    tags: ["#DemonSlayer", "#Tanjiro", "#HinokamiKagura", "#FireTheme", "#OrangeAesthetic", "#UfotableStyle", "#Shonen", "#Action", "#4K"],
    artist: "Ufotable_Fan"
  },
  {
    id: "jujutsu-kaisen-shibuya",
    title: "City Dusk",
    image: "/images/wallpapers/jujutsu_kaisen_shibuya.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "violet",
    downloads: 1532,
    favoritesCount: 812,
    anime: "Dark",
    editorial: true,
    rank: 3,
    fileSize: "903 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#190E2C", "#5C2E7E", "#B862D6", "#0D1117", "#E6E6E6"],
    tags: ["#JujutsuKaisen", "#ShibuyaIncident", "#Cityscape", "#DuskTheme", "#PurpleSky", "#Aesthetic", "#DarkTheme", "#UltraHD"],
    artist: "Void_Realm"
  },
  {
    id: "gojo-limitless",
    title: "Limitless",
    image: "/images/wallpapers/gojo_limitless.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "purple",
    downloads: 1120,
    favoritesCount: 610,
    anime: "Anime",
    editorial: false,
    rank: 6,
    fileSize: "1082 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#050811", "#1E3C72", "#6F00FF", "#00F5FF", "#FFFFFF"],
    tags: ["#JujutsuKaisen", "#GojoSatoru", "#Limitless", "#Infinity", "#BlueAura", "#Shonen", "#Action", "#4K"],
    artist: "Visual_Monarch"
  },
  {
    id: "demon-slayer-water",
    title: "Water Breathing",
    image: "/images/wallpapers/demon_slayer_water.png",
    ratio: "landscape",
    quality: "4K",
    resolution: "1024x1024",
    color: "blue",
    downloads: 876,
    favoritesCount: 395,
    anime: "Anime",
    editorial: false,
    rank: 8,
    fileSize: "1008 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#0A1D37", "#00E5FF", "#00A8CC", "#2C3E50", "#FFFFFF"],
    tags: ["#DemonSlayer", "#Tanjiro", "#WaterBreathing", "#BlueAesthetic", "#UfotableStyle", "#Landscape", "#UltraHD", "#4K"],
    artist: "Ufotable_Fan"
  },
  {
    id: "one-piece-red-dawn",
    title: "Red Dawn",
    image: "/images/wallpapers/one_piece_red_dawn.png",
    ratio: "landscape",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 1450,
    favoritesCount: 780,
    anime: "Anime",
    editorial: true,
    rank: 2,
    fileSize: "901 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#1A0202", "#D62828", "#FCBF49", "#F77F00", "#FFFFFF"],
    tags: ["#OnePiece", "#Luffy", "#RedDawn", "#Sunset", "#Silhouette", "#Landscape", "#8KResolution", "#EpicTheme"],
    artist: "Visual_Monarch"
  },
  {
    id: "naruto-sage-mode",
    title: "Sage Mode",
    image: "/images/wallpapers/naruto_sage_mode.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "yellow",
    downloads: 1390,
    favoritesCount: 710,
    anime: "Anime",
    editorial: true,
    rank: 5,
    fileSize: "804 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#241505", "#FF8C00", "#FFD700", "#2B2D42", "#FFFFFF"],
    tags: ["#Naruto", "#SageMode", "#OrangeTheme", "#YellowTheme", "#Shonen", "#Ninja", "#Action", "#Aesthetic", "#UltraHD"],
    artist: "Void_Realm"
  },
  {
    id: "lone-ronin",
    title: "Lone Ronin",
    image: "/images/wallpapers/dark_ronin.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 1640,
    favoritesCount: 890,
    anime: "Dark",
    editorial: true,
    rank: 1,
    fileSize: "893 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#0B0103", "#D90429", "#403D39", "#252422", "#FFFCF2"],
    tags: ["#Samurai", "#Ronin", "#DarkArt", "#CrimsonSplash", "#RedTheme", "#8KResolution", "#Aesthetic", "#Minimalist"],
    artist: "Void_Realm"
  },
  {
    id: "nature-peaks",
    title: "Serene Peaks",
    image: "/images/wallpapers/nature_peaks.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "orange",
    downloads: 780,
    favoritesCount: 320,
    anime: "Nature",
    editorial: false,
    rank: 9,
    fileSize: "889 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#121B14", "#2D6A4F", "#52B788", "#D8F3DC", "#FFB703"],
    tags: ["#Nature", "#Mountains", "#Forest", "#PineGreen", "#Sunrise", "#Mist", "#Aesthetic", "#Serene", "#4K"],
    artist: "Void_Realm"
  },
  {
    id: "minimal-eclipse",
    title: "Neon Eclipse",
    image: "/images/wallpapers/minimal_eclipse.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "purple",
    downloads: 920,
    favoritesCount: 430,
    anime: "Minimal",
    editorial: false,
    rank: 10,
    fileSize: "519 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#08040C", "#6F00FF", "#3F007F", "#1A0033", "#00FFCC"],
    tags: ["#Minimalist", "#Eclipse", "#NeonVibe", "#PurpleTheme", "#CyanAccent", "#Aesthetic", "#Space", "#UltraHD"],
    artist: "Void_Realm"
  },
  {
    id: "abstract-spectrum",
    title: "Liquid Spectrum",
    image: "/images/wallpapers/abstract_spectrum.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "blue",
    downloads: 1150,
    favoritesCount: 580,
    anime: "Abstract",
    editorial: false,
    rank: 11,
    fileSize: "787 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#0A1128", "#00F5D4", "#7B2CBF", "#FF007F", "#FFFFFF"],
    tags: ["#Abstract", "#Liquid", "#Iridescent", "#NeonColor", "#Psychedelic", "#8KResolution", "#Aesthetic", "#Premium"],
    artist: "Visual_Monarch"
  },
  {
    id: "attack-on-titan-rumbling",
    title: "The Rumbling",
    image: "/images/wallpapers/attack_on_titan_rumbling.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 1120,
    favoritesCount: 450,
    anime: "Anime",
    editorial: true,
    rank: 6,
    fileSize: "935 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#1E1106", "#D4A373", "#E07A5F", "#3D405B", "#FFFFFF"],
    tags: ["#AttackOnTitan", "#ErenJaeger", "#TheRumbling", "#ColossalTitan", "#Apocalypse", "#RedTheme", "#DarkAction", "#4K"],
    artist: "Studio_Mappa"
  },
  {
    id: "solo-leveling-shadow-monarch",
    title: "Shadow Monarch",
    image: "/images/wallpapers/solo_leveling_shadow_monarch.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "purple",
    downloads: 850,
    favoritesCount: 340,
    anime: "Anime",
    editorial: false,
    rank: 8,
    fileSize: "815 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#050014", "#4B0082", "#9400D3", "#00E5FF", "#E6E6E6"],
    tags: ["#SoloLeveling", "#SungJinwoo", "#ShadowArmy", "#PurpleTheme", "#DarkAction", "#Webtoon", "#UltraHD", "#4K"],
    artist: "Visual_Monarch"
  },
  {
    id: "bleach-bankai",
    title: "Bleach Bankai",
    image: "/images/wallpapers/bleach_bankai.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 740,
    favoritesCount: 298,
    anime: "Anime",
    editorial: false,
    rank: 9,
    fileSize: "904 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#0A0002", "#D90429", "#FFD700", "#1E1E1E", "#FFFFFF"],
    tags: ["#Bleach", "#IchigoKurosaki", "#Bankai", "#CrimsonReiatsu", "#Shonen", "#Action", "#4K", "#AnimeWallpaper"],
    artist: "Void_Realm"
  },
  {
    id: "sukuna-malevolent",
    title: "Malevolent Shrine",
    image: "/images/wallpapers/sukuna_malevolent.png",
    ratio: "portrait",
    quality: "4K",
    resolution: "1024x1024",
    color: "red",
    downloads: 910,
    favoritesCount: 402,
    anime: "Anime",
    editorial: true,
    rank: 23,
    fileSize: "993 KB",
    aspectRatio: "1:1",
    extractedPalette: ["#120101", "#D90429", "#FF5C5C", "#1E1E1E", "#FFFFFF"],
    tags: ["#JujutsuKaisen", "#Sukuna", "#MalevolentShrine", "#DarkAction", "#RedTheme", "#AnimeWallpaper", "#4K"],
    artist: "Studio_Mappa"
  },
  {
    id: "red-window-mockup",
    title: "Red Window Mockup",
    image: "/images/wallpapers/free_acrylic_table_sign_stand_mockup_red_wall_window_shadow_psd_compressed_1780434776653.webp",
    originalImage: "/images/wallpapers/original/free_acrylic_table_sign_stand_mockup_red_wall_window_shadow_psd_original_1780434776653.png",
    ratio: "landscape",
    quality: "4K",
    resolution: "4000x3000",
    color: "red",
    downloads: 320,
    favoritesCount: 110,
    anime: "Original",
    editorial: false,
    rank: 24,
    fileSize: "7.5 MB",
    aspectRatio: "4:3",
    extractedPalette: ["#F60000", "#F80000", "#9D0000", "#9C0000", "#F90000"],
    tags: ["#Original", "#RedTheme", "#Mockup", "#Wallpaper", "#4K"],
    artist: "RESIN"
  }
];

const defaultUsers = [
  {
    username: "founder",
    fullName: "Kaito Nakamura",
    email: "founder@resin.app",
    role: "Pro Member",
    avatar: "/images/avatars/avatar_alpha.png",
    location: "Tokyo, Japan",
    website: "https://resin.app",
    bio: "Founder of RESIN.\nDesigning digital worlds.",
    language: "English",
    timezone: "(GMT+9) Asia/Tokyo"
  }
];

const defaultFavorites = ["solo-leveling-shadow-monarch", "demon-slayer-hinokami", "gojo-limitless", "naruto-sage-mode", "lone-ronin", "jujutsu-kaisen-shibuya", "csm-04", "csm-08"];

const defaultHistory = [
  { id: "attack-on-titan-rumbling", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: "one-piece-red-dawn", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() }
];

const defaultArticles = {
  featured: {
    id: "featured",
    title: "The Evolution of Cyberpunk Neon: Shifting Metas in Digital Artwork Layouts",
    category: "DESIGN POST-MORTEM",
    publishDate: "Published May 2026",
    readTime: "9 min read",
    image: "/images/magazine/art_featured.png",
    caption: "Shibuya Protocol",
    likes: 1240,
    comments: 42,
    intro: "Cyberpunk aesthetics have always been more than just visual flair—they are a reflection of our relationship with technology, urban density, and speculative futures. Over the last decade, we've witnessed a dramatic shift in how neon, lighting, and composition are used to communicate mood, narrative, and identity in digital artwork.",
    paragraphs: [
      "<h2>From Blade Runner to Beyond</h2>",
      "The origins of cyberpunk neon can be traced back to foundational works like Blade Runner (1982), Akira (1988), and Ghost in the Shell (1995). These visual milestones established a language of contrast—neon against darkness, human against machine, order against chaos.",
      "<blockquote class=\"reader-blockquote\">\"Neon is no longer just a color overlay; it is a physical source of ambient glow that dictates every reflection, shadow, and sub-surface scattering in the scene.\"</blockquote>",
      "Yet, today's digital artists are going beyond homage. They're deconstructing and reassembling these elements in new, hybrid ways—blending retro-futurism with minimalism, glitchcore, and abstract storytelling.",
      "As we look to the future of digital layouts, the integration of these organic light sources with tactile UI elements will define the next decade of web and mobile design aesthetics."
    ],
    commentsList: [
      {
        id: 1,
        username: "@user_alpha",
        avatar: "/images/avatars/avatar_alpha.png",
        text: "The transition from direct neon highlights to ambient bouncing lighting has completely changed my 3D rendering workflow. It makes the world feel so much more integrated rather than just having flat glow lines.",
        time: "2 hours ago",
        likes: 14,
        liked: false
      },
      {
        id: 2,
        username: "@neon_diver",
        avatar: "/images/avatars/avatar_diver.png",
        text: "Honestly, combining flat vector interface overlays with hyper-realistic neon rendering is the ultimate design meta right now. The contrast between flat graphics and high-fidelity depth is stunning.",
        time: "4 hours ago",
        likes: 28,
        liked: false
      },
      {
        id: 3,
        username: "@grid_exe",
        avatar: "/images/avatars/avatar_grid.png",
        text: "This study hits the nail on the head. We are moving away from the purely high-contrast green-and-pink clichés into more curated atmospheric color pallets like warm amber and slate gray.",
        time: "6 hours ago",
        likes: 9,
        liked: false
      },
      {
        id: 4,
        username: "@retro_digest",
        avatar: "/images/avatars/avatar_retro.png",
        text: "Excellent breakdown! That quote about neon being an ambient light source dictating every reflection is so true. Raytracing has made this technique incredibly realistic for standard layouts.",
        time: "1 day ago",
        likes: 32,
        liked: false
      },
      {
        id: 5,
        username: "@pixel_vagrant",
        avatar: "/images/avatars/avatar_vagrant.png",
        text: "Is there a full PSD or Figma source file for the Shibuya Protocol layout? The integration of the vertical typography with the polaroid-style card borders is absolute perfection.",
        time: "2 days ago",
        likes: 5,
        liked: false
      }
    ]
  },
  top10: {
    id: "top10",
    title: "Top 10 Cyberpunk Anime You Need to Watch in 2026",
    category: "ANIME CRITIQUE",
    publishDate: "Published May 2026",
    readTime: "8 min read",
    image: "/images/magazine/art_top10.png",
    caption: "Crimson Protocol",
    likes: 852,
    comments: 18,
    intro: "The cyberpunk genre has experienced a resurgence in anime, pushing both thematic boundaries and animation techniques. From dark corporate dystopias to neon-lit hacker slums, these worlds serve as a warning and a mirror to our current technological age.",
    paragraphs: [
      "<h2>Reframing the Dystopia</h2>",
      "Leading the charge is a new wave of masterpieces that leverage hybrid 2D/3D layouts and dynamic camera movements. These shows explore complex philosophical questions: What does it mean to be human when your brain is hardwired to the net?",
      "<blockquote class=\"reader-blockquote\">\"True cyberpunk is not just high-tech and low-life; it is an exploration of human identity at the edge of biological and digital limits.\"</blockquote>",
      "In this list, we count down the absolute best cyberpunk anime of the year, analyzing their visual design, soundscapes, and narrative impact."
    ]
  },
  shinkai: {
    id: "shinkai",
    title: "Makoto Shinkai's Visual Storytelling: A Color & Emotion Study",
    category: "VISUAL STUDIES",
    publishDate: "Published May 2026",
    readTime: "7 min read",
    image: "/images/magazine/art_shinkai.png",
    caption: "Shooting Stars",
    likes: 941,
    comments: 31,
    intro: "Makoto Shinkai's name has become synonymous with breathtaking sky studies and heartbreaking long-distance romances. His films are recognizable by their vibrant, hyper-saturated color palettes, where skies aren't just blue, but blend into purples, pinks, and gold dust.",
    paragraphs: [
      "<h2>Color as a Silent Narrator</h2>",
      "In Shinkai's films, the environment is never passive. The weather, the clouds, and the stars express the unspoken longings of the characters, acting as a mirror to their internal emotional landscapes.",
      "<blockquote class=\"reader-blockquote\">\"In Shinkai's worlds, the environment is never passive. The weather, the clouds, and the stars express the unspoken longings of the characters.\"</blockquote>",
      "Shinkai uses advanced color theory to guide the viewer's eye and match the narrative arc of his films, creating a visual symphony that resonates long after the credits roll."
    ]
  },
  setup: {
    id: "setup",
    title: "The Ultimate 4K/8K Wallpaper Setup Guide (2026 Edition)",
    category: "HARDWARE TECH",
    publishDate: "Published May 2026",
    readTime: "10 min read",
    image: "/images/magazine/art_setup.png",
    caption: "Synapse Workstation",
    likes: 1540,
    comments: 65,
    intro: "Display technology has advanced rapidly, with 4K and 8K screens becoming the standard for gaming and creative workspaces. However, displaying a high-resolution wallpaper is not as simple as clicking 'set background'. Compression, aspect ratios, and color profiles all play a massive role in image fidelity.",
    paragraphs: [
      "<h2>Optimizing Pixels and Panels</h2>",
      "A premium wallpaper deserves a premium setup. Proper calibration ensures that dark hues remain deep and vibrant highlights do not wash out, representing the artist's original vision perfectly.",
      "<blockquote class=\"reader-blockquote\">\"Proper calibration ensures that dark hues remain deep and vibrant highlights do not wash out, letting sub-pixel details truly shine.\"</blockquote>",
      "In this comprehensive guide, we cover everything you need to optimize your desktop environment. Learn how to configure color spaces (sRGB vs. DCI-P3), eliminate compression artifacts, and scale wallpaper spans across dual-monitor layouts."
    ]
  },
  dark: {
    id: "dark",
    title: "The Rise of Dark Fantasy in Digital Art: Trends & Influences",
    category: "ART TRENDS",
    publishDate: "Published May 2026",
    readTime: "6 min read",
    image: "/images/magazine/art_dark.png",
    caption: "Eclipse Knight",
    likes: 672,
    comments: 12,
    intro: "Dark fantasy has captured the imagination of digital illustrators worldwide. Characterized by Gothic architecture, heavy shadows, and themes of corruption and despair, this aesthetic offers a striking contrast to bright, saturated designs.",
    paragraphs: [
      "<h2>The Allure of the Shadows</h2>",
      "We dissect the key elements of dark fantasy illustration: from brushwork that mimics charcoal and oil paint, to atmospheric perspective that makes ancient ruins feel looming and oppressive.",
      "<blockquote class=\"reader-blockquote\">\"Dark fantasy draws its strength from the unknown. The shadows must hold secrets, and the light must feel fragile and hard-won.\"</blockquote>",
      "We also explore the influence of classic literature and dark fantasy games on the current generation of digital artwork and visual styles."
    ]
  },
  mecha: {
    id: "mecha",
    title: "Mecha Design in Modern Anime: Engineering the Impossible",
    category: "ARTIST INTERVIEW",
    publishDate: "Published May 2026",
    readTime: "9 min read",
    image: "/images/magazine/art_mecha.png",
    caption: "Aegis Vanguard",
    likes: 812,
    comments: 24,
    intro: "Designing a giant robot requires a unique blend of mechanical engineering knowledge and artistic creativity. The most memorable mecha designs are those that feel functional—where every piston, joint, and thruster serves a visible purpose.",
    paragraphs: [
      "<h2>Balancing Physics and Fantasy</h2>",
      "We interview leading concept artists in the anime industry to learn how they approach mecha modeling. We discuss the transition from traditional hand-drawn mecha to 3D CGI, and how artists maintain the organic weight and style.",
      "<blockquote class=\"reader-blockquote\">\"A great mecha design must balance physics with fantasy, creating a silhouette that is iconic and a machine that looks ready to build and fight.\"</blockquote>",
      "By grounding mechanical titans in functional reality, artists create mecha that feel powerful, dangerous, and absolutely awe-inspiring."
    ]
  },
  tokyoghoul: {
    id: "tokyoghoul",
    title: "Tokyo Ghoul Revisited: Themes That Still Hit Hard",
    category: "ANIME CRITIQUE",
    publishDate: "Published May 2026",
    readTime: "8 min read",
    image: "/images/magazine/art_tokyoghoul.png",
    caption: "Tragic Awakening",
    likes: 1102,
    comments: 38,
    intro: "Tokyo Ghoul remains one of the most influential anime of its generation. Beyond its action sequences and supernatural elements, the series is a profound exploration of tragedy, empathy, and the grey areas of morality.",
    paragraphs: [
      "<h2>The Fracturing Mind</h2>",
      "We take a deep dive into the psychological undertones of the story, Kaneki Ken's transformation stages, and how the art style shifts from everyday normalcy to visceral madness, reflecting the protagonist's fracturing mind.",
      "<blockquote class=\"reader-blockquote\">\"Kaneki's journey is a tragic warning of how society creates the monsters it fears, and how empathy can be the heaviest burden of all.\"</blockquote>",
      "By re-examining Tokyo Ghoul, we understand how dark psychological themes can be visualised through contrasting color overlays and heavy organic shadows."
    ]
  },
  traditional: {
    id: "traditional",
    title: "Traditional Aesthetics in a Futuristic World: A Visual Paradox",
    category: "ARTIST SPOTLIGHT",
    publishDate: "Published May 2026",
    readTime: "7 min read",
    image: "/images/magazine/art_traditional.png",
    caption: "Zen Gateway",
    likes: 720,
    comments: 15,
    intro: "What happens when you combine ancient Japanese woodwork, calligraphy, and shinto gates with holographic displays and hover-trains? You get a beautiful, atmospheric subgenre of sci-fi art that feels simultaneously timeless and cutting-edge.",
    paragraphs: [
      "<h2>Rooted in the Sacred</h2>",
      "We explore the artists who are pioneering this visual paradox. We analyze how traditional textures (like rough paper and weathered wood) can be blended with digital light elements to create depth and contrast that standard sci-fi designs lack.",
      "<blockquote class=\"reader-blockquote\">\"By grounding futuristic technology in historical culture, artists create worlds that feel rooted, sacred, and infinitely deep.\"</blockquote>",
      "This fusion of ancient philosophy and speculative machinery creates a gorgeous, meditative layout that speaks to both our past and our future."
    ]
  }
};

const defaultCommunity = {
  pollVotes: [1242, 976, 739],
  downloads: 1294804,
  upvotes: 429812,
  members: 12842,
  activities: [
    {
      avatar: "/images/avatars/avatar_alpha.png",
      user: "@user_alpha",
      action: "favorited",
      target: "Solo Leveling: Shadow Monarch",
      wallpaper: "/images/wallpapers/solo_leveling_shadow_monarch.png",
      badge: "FAVORITE",
      time: "1 min ago"
    },
    {
      avatar: "/images/avatars/avatar_diver.png",
      user: "@neon_diver",
      action: "downloaded",
      target: "Bleach: Bankai",
      wallpaper: "/images/wallpapers/bleach_bankai.png",
      badge: "DOWNLOAD",
      time: "3 mins ago"
    },
    {
      avatar: "/images/avatars/avatar_grid.png",
      user: "@grid_exe",
      action: "downloaded",
      target: "Attack on Titan: The Rumbling",
      wallpaper: "/images/wallpapers/attack_on_titan_rumbling.png",
      badge: "DOWNLOAD",
      time: "6 mins ago"
    },
    {
      avatar: "/images/avatars/avatar_retro.png",
      user: "@retro_digest",
      action: "favorited",
      target: "Jujutsu Kaisen: Gojo Limitless",
      wallpaper: "/images/wallpapers/gojo_limitless.png",
      badge: "FAVORITE",
      time: "12 mins ago"
    },
    {
      avatar: "/images/avatars/avatar_vagrant.png",
      user: "@pixel_vagrant",
      action: "downloaded",
      target: "Dark Ronin",
      wallpaper: "/images/wallpapers/dark_ronin.png",
      badge: "DOWNLOAD",
      time: "18 mins ago"
    },
    {
      avatar: "/images/avatars/avatar_alpha.png",
      user: "@user_alpha",
      action: "downloaded",
      target: "Naruto: Sage Mode",
      wallpaper: "/images/wallpapers/naruto_sage_mode.png",
      badge: "DOWNLOAD",
      time: "24 mins ago"
    }
  ]
};

const defaultDmca = [
  {
    id: 'CLAIM-8842-X',
    claimant: 'Sarah Mitchell (Mitchell Artworks LLC)',
    infringingUrl: 'https://resin.tv/wallpapers/neon-cityscape-4k',
    allegationDescription: 'I am the exclusive copyright holder of the attached artwork titled "Neon Metropolis" created on March 3, 2025. The above URL contains an unauthorized copy of my original work, which is being distributed without my permission and causing irreparable harm to my licensing business.',
    swearSignature: 'Sarah Mitchell',
    submittedAt: 'May 23, 2026 - 14:02',
    status: 'Pending Investigation',
    files: ['/images/wallpapers/dark_ronin.png']
  },
  {
    id: 'CLAIM-8841-Y',
    claimant: 'David Chen (Chen Design Studio)',
    infringingUrl: 'https://resin.tv/art/abstract-neural-network',
    allegationDescription: 'Unauthorized commercial use of my abstract network design.',
    swearSignature: 'David Chen',
    submittedAt: 'May 23, 2026 - 11:19',
    status: 'Pending Investigation',
    files: ['/images/wallpapers/abstract_spectrum.png']
  },
  {
    id: 'CLAIM-8839-A',
    claimant: 'James Ortega (Ortega Photography)',
    infringingUrl: 'https://resin.tv/nature/mountain-lake-sunrise',
    allegationDescription: 'This photograph was stolen from my premium portfolio.',
    swearSignature: 'James Ortega',
    submittedAt: 'May 22, 2026 - 22:47',
    status: 'Pending Investigation',
    files: ['/images/wallpapers/nature_peaks.png']
  }
];

const defaultReports = [
  {
    id: "RPT-B842-X",
    type: "image",
    iconHtml: '<img src="https://images.unsplash.com/photo-1542451542907-6cf80ff362d6?w=100&h=100&fit=crop" alt="Neon City">',
    title: "LOW QUALITY / AI SLOP",
    target: "Neon Dreams Cityscape",
    by: "@pixel_hunter",
    time: "12m ago",
    reports: 14,
    severity: "high",
    uploader: "@alpha_design",
    uploadTime: "May 23, 2026 - 14:02",
    imageFull: "https://images.unsplash.com/photo-1542451542907-6cf80ff362d6?w=600&h=337&fit=crop",
    ledger: [
      { rep: "@pixel_hunter", avatar: "https://i.pravatar.cc/100?img=33", text: "This is clearly AI generated. Notice the hands and text.", score: 92, time: "12m ago", scoreClass: "score-high" },
      { rep: "@quality_enforcer", avatar: "https://i.pravatar.cc/100?img=47", text: "Low quality, heavy compression artifacts. Not 4K as advertised.", score: 88, time: "14m ago", scoreClass: "score-high" },
      { rep: "@real_res_checker", avatar: "https://i.pravatar.cc/100?img=11", text: "Upscaled from 1080p. Pixel density is fake.", score: 95, time: "16m ago", scoreClass: "score-high" }
    ],
    context: { category: "Cyberpunk", res: "3840x2160", size: "6.2 MB", upvotes: "1,842", views: "24,781" },
    metrics: { nested: "14", first: "12m ago", last: "1m ago", totalUp: "1,842", violations: "2 Prior Warns" },
    status: "Open"
  },
  {
    id: "RPT-T991-A",
    type: "tag",
    iconHtml: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>',
    title: "MISCATEGORIZED TAG",
    target: "Zen Garden Sunset",
    by: "@tag_police",
    time: "18m ago",
    reports: 7,
    severity: "medium",
    uploader: "@zen_master",
    uploadTime: "May 24, 2026 - 09:15",
    imageFull: "https://images.unsplash.com/photo-1528310901416-a5e4d0285227?w=600&h=337&fit=crop",
    ledger: [
      { rep: "@tag_police", avatar: "https://i.pravatar.cc/100?img=12", text: "Tagged as 'Action' but it's clearly 'Scenery'.", score: 75, time: "18m ago", scoreClass: "score-med" }
    ],
    context: { category: "Scenery", res: "1920x1080", size: "1.4 MB", upvotes: "320", views: "5,112" },
    metrics: { nested: "7", first: "18m ago", last: "5m ago", totalUp: "320", violations: "None" },
    status: "Open"
  },
  {
    id: "RPT-S002-B",
    type: "bot",
    iconHtml: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8.01" y2="16"></line><line x1="16" y1="16" x2="16.01" y2="16"></line></svg>',
    title: "SPAM / SELF-PROMOTION",
    target: "USER: @earnfast_online",
    by: "@community_guardian",
    time: "25m ago",
    reports: 22,
    severity: "high",
    uploader: "@earnfast_online",
    uploadTime: "Account Created: May 25, 2026",
    imageFull: "https://images.unsplash.com/photo-1562564055-71e051d33c19?w=600&h=337&fit=crop",
    ledger: [
      { rep: "@community_guard", avatar: "https://i.pravatar.cc/100?img=55", text: "Spamming link in multiple threads.", score: 98, time: "25m ago", scoreClass: "score-high" }
    ],
    context: { category: "User Acct", res: "N/A", size: "N/A", upvotes: "N/A", views: "N/A" },
    metrics: { nested: "22", first: "25m ago", last: "2m ago", totalUp: "N/A", violations: "Multiple" },
    status: "Open"
  },
  {
    id: "RPT-F555-C",
    type: "image",
    iconHtml: '<img src="https://images.unsplash.com/photo-1506744626753-eda8151a747b?w=100&h=100&fit=crop" alt="Mountain">',
    title: "BROKEN FILE / CORRUPTED",
    target: "Mountain Lake 8K",
    by: "@tech_check",
    time: "31m ago",
    reports: 5,
    severity: "medium",
    uploader: "@nature_lover",
    uploadTime: "May 25, 2026 - 11:30",
    imageFull: "https://images.unsplash.com/photo-1506744626753-eda8151a747b?w=600&h=337&fit=crop",
    ledger: [
      { rep: "@tech_check", avatar: "https://i.pravatar.cc/100?img=68", text: "Download fails at 50%. Archive is corrupted.", score: 85, time: "31m ago", scoreClass: "score-high" }
    ],
    context: { category: "Nature", res: "7680x4320", size: "45.2 MB", upvotes: "1,205", views: "18,400" },
    metrics: { nested: "5", first: "31m ago", last: "10m ago", totalUp: "1,205", violations: "None" },
    status: "Open"
  }
];

const articleFallbackComments = [
  {
    id: 101,
    username: "@neon_diver",
    avatar: "/images/avatars/avatar_diver.png",
    text: "This is exactly the resource I needed. The design system details are incredibly helpful!",
    time: "3 hours ago",
    likes: 12,
    liked: false
  },
  {
    id: 102,
    username: "@user_alpha",
    avatar: "/images/avatars/avatar_alpha.png",
    text: "Really interesting points here. I definitely agree with the main arguments.",
    time: "5 hours ago",
    likes: 8,
    liked: false
  },
  {
    id: 103,
    username: "@retro_digest",
    avatar: "/images/avatars/avatar_retro.png",
    text: "Love the layout and presentation of this article! Keep it up.",
    time: "1 day ago",
    likes: 15,
    liked: false
  }
];

Object.keys(defaultArticles).forEach(key => {
  if (key !== "featured") {
    defaultArticles[key].commentsList = [...articleFallbackComments];
  }
});

// ==========================================
// UNIFIED ENGINE LOADER & DB INSTANTIATOR
// ==========================================

let isSQLite = false;
let sqliteDb = null;

// Instantiate the custom JSON stores immediately (serving as our fallback engine)
const wallpapersStore = new LocalJSONStore("wallpapers.json", defaultWallpapers);
const usersStore = new LocalJSONStore("users.json", defaultUsers);
const favoritesStore = new LocalJSONStore("favorites.json", defaultFavorites);
const historyStore = new LocalJSONStore("history.json", defaultHistory);
const articlesStore = new LocalJSONStore("articles.json", defaultArticles);
const communityStore = new LocalJSONStore("community.json", defaultCommunity);
const dmcaStore = new LocalJSONStore("dmca.json", defaultDmca);
const reportsStore = new LocalJSONStore("reports.json", defaultReports);
const collectionsStore = new LocalJSONStore("collections.json", []);
const defaultSystemSettings = {
  siteName: 'RESIN',
  maintenanceMode: 0,
  publicSignups: 1,
  telemetryLogging: 1,
  maxUploadSize: 50,
  allowedFormats: ["jpg", "jpeg", "png", "gif", "webp", "mp4"],
  leaderboardConfig: {
    timeframe: '24H',
    weights: { dl: 1.5, sv: 2.0, vw: 0.5 },
    advanced: { botSensitivity: 'High', cooldown: '60 minutes', minSharedSaves: 10 }
  },
  cdnEndpoint: "",
  discordWebhook: ""
};
const systemSettingsStore = new LocalJSONStore("system_settings.json", defaultSystemSettings);
const defaultCategories = [
  { id: 1, name: "DESIGN POST-MORTEM", slug: "design-post-mortem", description: "In-depth design breakdowns and post-mortems" },
  { id: 2, name: "ANIME CRITIQUE", slug: "anime-critique", description: "Critical reviews and commentary on anime series" },
  { id: 3, name: "VISUAL STUDIES", slug: "visual-studies", description: "Exploring art styles, aesthetics, and cinematography" },
  { id: 4, name: "HARDWARE TECH", slug: "hardware-tech", description: "Articles about hardware tech, setups, and gear" },
  { id: 5, name: "ART TRENDS", slug: "art-trends", description: "Latest styles and trends in the digital art world" },
  { id: 6, name: "ARTIST INTERVIEW", slug: "artist-interview", description: "Conversations with notable community artists" },
  { id: 7, name: "ARTIST SPOTLIGHT", slug: "artist-spotlight", description: "Highlighting creative works of featured artists" }
];
const categoriesStore = new LocalJSONStore("categories.json", defaultCategories);
const mediaStore = new LocalJSONStore("media.json", []);

const defaultSupportTickets = [
  { id: '#TK-4029', user: '@void_seeker', email: 'seeker@resin.app', subject: 'Wallpaper ingestion failure with 4K resolution payload', category: 'System', status: 'Awaiting Response', time: '2m ago', messages: [
    { sender: 'user', content: 'Hey, I tried uploading a 4K wallpaper (Neon Glimmer) which is around 38MB, but it keeps failing at the resolution extraction phase. Help!', time: '14:00:21' }
  ] },
  { id: '#TK-3011', user: '@retro_grid', email: 'retro@grid.org', subject: 'Inconsistent billing cycle for premium subscription tier', category: 'Billing', status: 'Awaiting Response', time: '15m ago', messages: [
    { sender: 'user', content: 'My subscription was renewed on May 28, but I received a notification saying my billing cycle is overdue. Can you check?', time: '13:47:10' }
  ] },
  { id: '#TK-2088', user: '@diver_alpha', email: 'diver@alpha.net', subject: 'Copyright take-down inquiry regarding uploaded asset id 8719', category: 'Legal', status: 'Awaiting Response', time: '1h ago', messages: [
    { sender: 'user', content: 'Hello, my artwork is copyrighted, and I notice someone uploaded a replica under ID 8719. Please investigate.', time: '13:02:44' }
  ] },
  { id: '#TK-1055', user: '@cyber_ghost', email: 'ghost@cyber.net', subject: 'Requesting permission scope upgrade to uploader status', category: 'Account', status: 'Resolved', time: '1d ago', messages: [
    { sender: 'user', content: 'I would like to apply for the Content Uploader role. Here is a link to my portfolio of digital illustration works.', time: 'Yesterday' },
    { sender: 'support', content: 'Your portfolio has been reviewed and approved! Your account has been upgraded to Content Creator status.', time: 'Yesterday' }
  ] }
];

const announcementsStore = new LocalJSONStore("announcements.json", []);
const supportTicketsStore = new LocalJSONStore("support_tickets.json", defaultSupportTickets);

const defaultDocuments = [
  {
    id: "doc-1",
    title: "Platform Update: May 2026",
    author: "Administrator",
    status: "Published",
    lastModified: "2026-05-23T14:02:00.000Z",
    content: "<p>We're excited to introduce a series of powerful updates designed to enhance performance...</p><p>This release includes infrastructure upgrades, new moderation capabilities, and major improvements to the ingestion pipeline. Thank you for being part of the RESIN community.</p>",
    excerpt: "A brief overview of the major platform updates rolling out in May 2026.",
    urlSlug: "/blog/platform-update-may-2026",
    coverAsset: "",
    tags: ["Announcements", "Platform Updates", "Community", "Product"]
  },
  {
    id: "doc-2",
    title: "Community Guidelines v2.0",
    author: "Administrator",
    status: "Published",
    lastModified: "2026-05-20T09:31:00.000Z",
    content: "<p>These are the new community guidelines.</p>",
    excerpt: "Updated community guidelines.",
    urlSlug: "/guidelines/v2",
    coverAsset: "",
    tags: ["Guidelines"]
  },
  {
    id: "doc-3",
    title: "DMCA Policy & Procedures",
    author: "Legal Core",
    status: "Published",
    lastModified: "2026-05-18T16:44:00.000Z",
    content: "<p>DMCA Policy details.</p>",
    excerpt: "DMCA Policy and takedown procedures.",
    urlSlug: "/legal/dmca",
    coverAsset: "",
    tags: ["Legal"]
  },
  {
    id: "doc-4",
    title: "Roadmap: Q2 2026",
    author: "Administrator",
    status: "Draft",
    lastModified: "2026-05-22T11:08:00.000Z",
    content: "<p>Upcoming features in Q2.</p>",
    excerpt: "Roadmap for Q2 2026.",
    urlSlug: "/roadmap/q2-2026",
    coverAsset: "",
    tags: ["Roadmap"]
  },
  {
    id: "doc-5",
    title: "Terms of Service",
    author: "Legal Core",
    status: "Published",
    lastModified: "2026-05-12T10:12:00.000Z",
    content: "<p>Terms of service.</p>",
    excerpt: "Resin Terms of Service.",
    urlSlug: "/legal/tos",
    coverAsset: "",
    tags: ["Legal"]
  },
  {
    id: "doc-6",
    title: "Privacy Policy",
    author: "Legal Core",
    status: "Published",
    lastModified: "2026-05-12T10:12:00.000Z",
    content: "<p>Privacy policy.</p>",
    excerpt: "Resin Privacy Policy.",
    urlSlug: "/legal/privacy",
    coverAsset: "",
    tags: ["Legal"]
  },
  {
    id: "doc-7",
    title: "Partner Program Overview",
    author: "Growth Team",
    status: "Draft",
    lastModified: "2026-05-21T13:55:00.000Z",
    content: "<p>Partner program details.</p>",
    excerpt: "Overview of the partner program.",
    urlSlug: "/partners/overview",
    coverAsset: "",
    tags: ["Growth"]
  },
  {
    id: "doc-8",
    title: "API Documentation",
    author: "DevRel",
    status: "Draft",
    lastModified: "2026-05-19T17:03:00.000Z",
    content: "<p>API documentation.</p>",
    excerpt: "Documentation for developers.",
    urlSlug: "/developers/api",
    coverAsset: "",
    tags: ["API", "DevRel"]
  }
];
const documentsStore = new LocalJSONStore("documents.json", defaultDocuments);

try {
  const { DatabaseSync } = require('node:sqlite');
  const dbFile = path.join(DATA_DIR, 'resin.db');
  sqliteDb = new DatabaseSync(dbFile);
  isSQLite = true;
  console.log("[DATABASE] Zero-dependency SQLite engine successfully initialized.");
} catch (err) {
  console.log("[DATABASE] node:sqlite is not supported on this platform. Seamless JSON fallback active.");
}

// ==========================================
// SQLITE SCHEMA DEFINITIONS & DATA MIGRATIONS
// ==========================================

if (isSQLite && sqliteDb) {
  // 1. Compile schema structural tables
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS wallpapers (
      id TEXT PRIMARY KEY,
      title TEXT,
      image TEXT,
      ratio TEXT,
      quality TEXT,
      resolution TEXT,
      color TEXT,
      downloads INTEGER,
      favoritesCount INTEGER,
      anime TEXT,
      editorial INTEGER,
      rank INTEGER,
      fileSize TEXT,
      aspectRatio TEXT,
      extractedPalette TEXT,
      tags TEXT,
      artist TEXT,
      originalImage TEXT
    );
    
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT,
      author TEXT,
      status TEXT,
      lastModified TEXT,
      content TEXT,
      coverAsset TEXT,
      urlSlug TEXT,
      excerpt TEXT,
      tags TEXT
    );
    
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      fullName TEXT,
      email TEXT UNIQUE,
      salt TEXT,
      passwordHash TEXT,
      role TEXT,
      avatar TEXT,
      location TEXT,
      website TEXT,
      bio TEXT,
      language TEXT,
      timezone TEXT,
      likedArticles TEXT,
      savedArticles TEXT,
      recoveryToken TEXT,
      recoveryTokenExpiry INTEGER,
      status TEXT DEFAULT 'ACTIVE',
      joinedAt TEXT
    );
    
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT,
      wallpaperId TEXT,
      UNIQUE(sessionId, wallpaperId)
    );
    
    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT,
      wallpaperId TEXT,
      timestamp TEXT
    );
    
    CREATE TABLE IF NOT EXISTS articles (
      id TEXT PRIMARY KEY,
      title TEXT,
      category TEXT,
      publishDate TEXT,
      readTime TEXT,
      image TEXT,
      caption TEXT,
      likes INTEGER,
      comments INTEGER,
      intro TEXT,
      paragraphs TEXT,
      commentsList TEXT
    );
    
    CREATE TABLE IF NOT EXISTS community (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    
    CREATE TABLE IF NOT EXISTS dmca (
      id TEXT PRIMARY KEY,
      claimant TEXT,
      infringingUrl TEXT,
      allegationDescription TEXT,
      files TEXT,
      swearSignature TEXT,
      submittedAt TEXT,
      status TEXT
    );
    
    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      type TEXT,
      targetId TEXT,
      target TEXT,
      iconHtml TEXT,
      title TEXT,
      by TEXT,
      time TEXT,
      reports INTEGER,
      severity TEXT,
      uploader TEXT,
      uploadTime TEXT,
      imageFull TEXT,
      ledger TEXT,
      context TEXT,
      metrics TEXT,
      status TEXT
    );
    
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      coverImage TEXT,
      assets TEXT,
      featured INTEGER DEFAULT 0,
      isDraft INTEGER DEFAULT 0,
      createdAt TEXT
    );
    
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT,
      adminEmail TEXT,
      timestamp TEXT,
      details TEXT
    );
    
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE,
      slug TEXT UNIQUE,
      description TEXT
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE,
      url TEXT,
      mimeType TEXT,
      size INTEGER,
      uploadedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      body TEXT,
      type TEXT,
      isPinned INTEGER,
      createdAt TEXT
    );

    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      user TEXT,
      email TEXT,
      subject TEXT,
      category TEXT,
      status TEXT,
      time TEXT,
      messages TEXT
    );
  `);

  // 2. Auto-run transactional migration checks
  
  // Alter check for originalImage column
  try {
    sqliteDb.exec("ALTER TABLE wallpapers ADD COLUMN originalImage TEXT");
  } catch (e) {
    // Ignore error if column already exists
  }

  // Alter check for claimant column in dmca
  try {
    sqliteDb.exec("ALTER TABLE dmca ADD COLUMN claimant TEXT");
  } catch (e) {
    // Ignore error if column already exists
  }

  // Alter check for target column in reports
  try {
    sqliteDb.exec("ALTER TABLE reports ADD COLUMN target TEXT");
  } catch (e) {
    // Ignore error if column already exists
  }

  // Alter check for iconHtml column in reports
  try {
    sqliteDb.exec("ALTER TABLE reports ADD COLUMN iconHtml TEXT");
  } catch (e) {
    // Ignore error if column already exists
  }

  // Wallpapers table migration
  const countWps = sqliteDb.prepare("SELECT COUNT(*) as count FROM wallpapers").get();
  if (countWps.count === 0) {
    console.log("[MIGRATION] Seeding wallpapers table from source files...");
    const seedWps = wallpapersStore.data;
    const insertWp = sqliteDb.prepare(`
      INSERT INTO wallpapers (id, title, image, ratio, quality, resolution, color, downloads, favoritesCount, anime, editorial, rank, fileSize, aspectRatio, extractedPalette, tags, artist)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedWps.forEach(w => {
      insertWp.run(
        w.id, w.title, w.image, w.ratio, w.quality, w.resolution, w.color, w.downloads, w.favoritesCount, w.anime, w.editorial ? 1 : 0, w.rank, w.fileSize, w.aspectRatio,
        JSON.stringify(w.extractedPalette || []), JSON.stringify(w.tags || []), w.artist
      );
    });
  }

  // Users table migration
  const countUsers = sqliteDb.prepare("SELECT COUNT(*) as count FROM users").get();
  if (countUsers.count === 0) {
    console.log("[MIGRATION] Seeding users table...");
    const seedUsers = usersStore.data;
    const insertUser = sqliteDb.prepare(`
      INSERT INTO users (username, fullName, email, salt, passwordHash, role, avatar, location, website, bio, language, timezone, likedArticles, savedArticles)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedUsers.forEach(u => {
      let salt = u.salt;
      let passwordHash = u.passwordHash;
      if (u.password) {
        const hashed = hashPassword(u.password);
        salt = hashed.salt;
        passwordHash = hashed.hash;
      } else if (!passwordHash && getSeedPassword()) {
        const hashed = hashPassword(getSeedPassword());
        salt = hashed.salt;
        passwordHash = hashed.hash;
      }
      insertUser.run(
        u.username, u.fullName, u.email, salt, passwordHash, u.role, u.avatar, u.location, u.website, u.bio, u.language, u.timezone,
        JSON.stringify(u.likedArticles || []), JSON.stringify(u.savedArticles || [])
      );
    });
  }

  // Articles table migration
  const countArticles = sqliteDb.prepare("SELECT COUNT(*) as count FROM articles").get();
  if (countArticles.count === 0) {
    console.log("[MIGRATION] Seeding articles table...");
    const seedArticles = articlesStore.data;
    const insertArt = sqliteDb.prepare(`
      INSERT INTO articles (id, title, category, publishDate, readTime, image, caption, likes, comments, intro, paragraphs, commentsList)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    Object.keys(seedArticles).forEach(key => {
      const a = seedArticles[key];
      insertArt.run(
        a.id, a.title, a.category, a.publishDate, a.readTime, a.image, a.caption, a.likes, a.comments, a.intro,
        JSON.stringify(a.paragraphs || []), JSON.stringify(a.commentsList || [])
      );
    });
  }

  // Documents table migration
  const countDocs = sqliteDb.prepare("SELECT COUNT(*) as count FROM documents").get();
  if (countDocs.count === 0) {
    console.log("[MIGRATION] Seeding documents table...");
    const seedDocs = documentsStore.data;
    const insertDoc = sqliteDb.prepare(`
      INSERT INTO documents (id, title, author, status, lastModified, content, coverAsset, urlSlug, excerpt, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedDocs.forEach(d => {
      insertDoc.run(
        d.id, d.title, d.author, d.status, d.lastModified, d.content, d.coverAsset, d.urlSlug, d.excerpt, JSON.stringify(d.tags || [])
      );
    });
  }

  // Favorites migration
  const countFavs = sqliteDb.prepare("SELECT COUNT(*) as count FROM favorites").get();
  if (countFavs.count === 0) {
    const seedFavs = favoritesStore.data;
    const insertFav = sqliteDb.prepare("INSERT OR IGNORE INTO favorites (sessionId, wallpaperId) VALUES (?, ?)");
    seedFavs.forEach(wpId => {
      insertFav.run('default_session', wpId);
    });
  }

  // History migration
  const countHist = sqliteDb.prepare("SELECT COUNT(*) as count FROM history").get();
  if (countHist.count === 0) {
    const seedHist = historyStore.data;
    const insertHist = sqliteDb.prepare("INSERT INTO history (sessionId, wallpaperId, timestamp) VALUES (?, ?, ?)");
    seedHist.forEach(h => {
      insertHist.run('default_session', h.id, h.timestamp);
    });
  }

  // Community table migration
  const countComm = sqliteDb.prepare("SELECT COUNT(*) as count FROM community").get();
  if (countComm.count === 0) {
    const seedComm = communityStore.data;
    const insertComm = sqliteDb.prepare("INSERT INTO community (key, value) VALUES (?, ?)");
    insertComm.run('pulseStats', JSON.stringify(seedComm));
  }

  // System settings table migration
  const countSettings = sqliteDb.prepare("SELECT COUNT(*) as count FROM system_settings").get();
  if (countSettings.count === 0) {
    const seedSettings = systemSettingsStore.data;
    const insertSettings = sqliteDb.prepare("INSERT INTO system_settings (key, value) VALUES (?, ?)");
    for (const key in seedSettings) {
      insertSettings.run(key, JSON.stringify(seedSettings[key]));
    }
  }

  // Categories table migration
  const countCategories = sqliteDb.prepare("SELECT COUNT(*) as count FROM categories").get();
  if (countCategories.count === 0) {
    console.log("[MIGRATION] Seeding categories table...");
    const seedCats = categoriesStore.data;
    const insertCat = sqliteDb.prepare("INSERT INTO categories (id, name, slug, description) VALUES (?, ?, ?, ?)");
    seedCats.forEach(c => {
      insertCat.run(c.id, c.name, c.slug, c.description);
    });
  }

  // Media table migration
  const countMedia = sqliteDb.prepare("SELECT COUNT(*) as count FROM media").get();
  if (countMedia.count === 0) {
    console.log("[MIGRATION] Seeding media table...");
    const seedMed = mediaStore.data;
    const insertMed = sqliteDb.prepare("INSERT INTO media (id, filename, url, mimeType, size, uploadedAt) VALUES (?, ?, ?, ?, ?, ?)");
    seedMed.forEach(m => {
      insertMed.run(m.id, m.filename, m.url, m.mimeType, m.size, m.uploadedAt);
    });
  }

  // DMCA table migration
  const countDmca = sqliteDb.prepare("SELECT COUNT(*) as count FROM dmca").get();
  if (countDmca.count === 0) {
    console.log("[MIGRATION] Seeding dmca table...");
    const seedDmca = dmcaStore.data;
    const insertDmca = sqliteDb.prepare(`
      INSERT INTO dmca (id, claimant, infringingUrl, allegationDescription, files, swearSignature, submittedAt, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedDmca.forEach(d => {
      insertDmca.run(d.id, d.claimant || d.swearSignature || null, d.infringingUrl, d.allegationDescription, JSON.stringify(d.files || []), d.swearSignature, d.submittedAt, d.status);
    });
  }

  // Reports table migration
  const countReports = sqliteDb.prepare("SELECT COUNT(*) as count FROM reports").get();
  if (countReports.count === 0) {
    console.log("[MIGRATION] Seeding reports table...");
    const seedReports = reportsStore.data;
    const insertReport = sqliteDb.prepare(`
      INSERT INTO reports (id, type, targetId, target, iconHtml, title, by, time, reports, severity, uploader, uploadTime, imageFull, ledger, context, metrics, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedReports.forEach(r => {
      insertReport.run(
        r.id, r.type, r.targetId || null, r.target || null, r.iconHtml || null, r.title, r.by, r.time, r.reports, r.severity, r.uploader, r.uploadTime, r.imageFull,
        JSON.stringify(r.ledger || []), JSON.stringify(r.context || {}), JSON.stringify(r.metrics || {}), r.status
      );
    });
  }

  // Support tickets table migration
  const countTickets = sqliteDb.prepare("SELECT COUNT(*) as count FROM support_tickets").get();
  if (countTickets.count === 0) {
    console.log("[MIGRATION] Seeding support tickets table...");
    const seedTickets = supportTicketsStore.data;
    const insertTicket = sqliteDb.prepare(`
      INSERT INTO support_tickets (id, user, email, subject, category, status, time, messages)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    seedTickets.forEach(t => {
      insertTicket.run(t.id, t.user, t.email, t.subject, t.category, t.status, t.time, typeof t.messages === 'string' ? t.messages : JSON.stringify(t.messages));
    });
  }

  // Collections table migration
  const countCollections = sqliteDb.prepare("SELECT COUNT(*) as count FROM collections").get();
  if (countCollections.count === 0) {
    console.log("[MIGRATION] Seeding collections table in SQLite...");
    const csmWallpapers = sqliteDb.prepare("SELECT id FROM wallpapers WHERE anime = 'Chainsaw Man'").all();
    const csmIds = csmWallpapers.map(w => w.id);
    
    sqliteDb.prepare(`
      INSERT INTO collections (id, title, description, coverImage, assets, featured, isDraft, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'chainsaw-man',
      'Chainsaw Man Complete Pack',
      'The ultimate Chainsaw Man wallpaper pack curated by the RESIN team, featuring high-res 4K artworks of Denji, Makima, Power, and the Devil Hunters.',
      '/images/wallpapers/chainsaw_awakening.png',
      JSON.stringify(csmIds),
      1,
      0,
      new Date().toISOString()
    );
  }

  // Administrator account seeding in SQLite
  const adminCheck = sqliteDb.prepare("SELECT COUNT(*) as count FROM users WHERE username = 'godmode'").get();
  if (adminCheck.count === 0) {
    if (getSeedPassword()) {
      console.log("[MIGRATION] Seeding Administrator account (@godmode) in SQLite...");
      const adminCreds = hashPassword(getSeedPassword());
      sqliteDb.prepare(`
        INSERT INTO users (username, fullName, email, salt, passwordHash, role, avatar, location, website, bio, language, timezone, likedArticles, savedArticles)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'godmode',
        'Administrator',
        process.env.ADMIN_EMAIL || 'admin@resin.app',
        adminCreds.salt,
        adminCreds.hash,
        'Administrator',
        '/images/avatars/avatar_retro.png',
        'Command Center',
        'https://resin.app/admin',
        'RESIN administrator.',
        'English',
        '(GMT+0) UTC',
        '[]',
        '[]'
      );
    } else {
      console.warn("[MIGRATION] Administrator account was not seeded. Set ADMIN_PASSWORD before first production boot.");
    }
  }
}

// Administrator account seeding in JSON memory store (fallback)
const adminExists = usersStore.data.some(u => u.username === 'godmode');
if (!adminExists) {
  if (getSeedPassword()) {
    console.log("[MIGRATION] Seeding Administrator account (@godmode) into JSON memory store...");
    const adminCreds = hashPassword(getSeedPassword());
    usersStore.data.push({
      username: 'godmode',
      fullName: 'Administrator',
      email: process.env.ADMIN_EMAIL || 'admin@resin.app',
      salt: adminCreds.salt,
      passwordHash: adminCreds.hash,
      role: 'Administrator',
      avatar: '/images/avatars/avatar_retro.png',
      location: 'Command Center',
      website: 'https://resin.app/admin',
      bio: 'RESIN administrator.',
      language: 'English',
      timezone: '(GMT+0) UTC',
      likedArticles: [],
      savedArticles: []
    });
    usersStore.save();
  } else {
    console.warn("[MIGRATION] Administrator account was not seeded. Set ADMIN_PASSWORD before first production boot.");
  }
}

// Collections seeding in JSON memory store (fallback)
if (collectionsStore.data.length === 0) {
  console.log("[MIGRATION] Seeding collections table in JSON memory store...");
  const csmWallpapers = wallpapersStore.data.filter(w => w.anime === 'Chainsaw Man');
  const csmIds = csmWallpapers.map(w => w.id);
  collectionsStore.data.push({
    id: 'chainsaw-man',
    title: 'Chainsaw Man Complete Pack',
    description: 'The ultimate Chainsaw Man wallpaper pack curated by the RESIN team, featuring high-res 4K artworks of Denji, Makima, Power, and the Devil Hunters.',
    coverImage: '/images/wallpapers/chainsaw_awakening.png',
    assets: csmIds,
    featured: true,
    isDraft: false,
    createdAt: new Date().toISOString()
  });
  collectionsStore.save();
}

// ==========================================
// UNIFIED GETTER/SETTER API WRAPPERS
// ==========================================

const db = {
  isSQLite,
  dataDir: DATA_DIR,
  hashPassword,
  verifyPassword,
  isBcryptHash,
  needsPasswordRehash,

  wallpapers: {
    get data() {
      if (isSQLite && sqliteDb) {
        const rows = sqliteDb.prepare("SELECT * FROM wallpapers").all();
        return rows.map(r => ({
          ...r,
          editorial: r.editorial === 1,
          extractedPalette: JSON.parse(r.extractedPalette || '[]'),
          tags: JSON.parse(r.tags || '[]')
        }));
      } else {
        return wallpapersStore.data;
      }
    },
    save() {
      if (isSQLite) return true;
      return wallpapersStore.save();
    },
    updateDownloads(id) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE wallpapers SET downloads = downloads + 1 WHERE id = ?").run(id);
      } else {
        const wp = wallpapersStore.data.find(w => w.id === id);
        if (wp) {
          wp.downloads += 1;
          wallpapersStore.save();
        }
      }
    },
    updateFavoritesCount(id, increment) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE wallpapers SET favoritesCount = MAX(0, favoritesCount + ?) WHERE id = ?").run(increment, id);
      } else {
        const wp = wallpapersStore.data.find(w => w.id === id);
        if (wp) {
          wp.favoritesCount = Math.max(0, wp.favoritesCount + increment);
          wallpapersStore.save();
        }
      }
    },
    addWallpaper(w) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare(`
          INSERT INTO wallpapers (id, title, image, ratio, quality, resolution, color, downloads, favoritesCount, anime, editorial, rank, fileSize, aspectRatio, extractedPalette, tags, artist, originalImage)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          w.id, w.title, w.image, w.ratio, w.quality, w.resolution, w.color, w.downloads || 0, w.favoritesCount || 0, w.anime, w.editorial ? 1 : 0, w.rank || 0, w.fileSize || '1 MB', w.aspectRatio || '16:9',
          JSON.stringify(w.extractedPalette || []), JSON.stringify(w.tags || []), w.artist, w.originalImage
        );
      } else {
        wallpapersStore.data.push(w);
        wallpapersStore.save();
      }
    },
    deleteWallpaper(id) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("DELETE FROM wallpapers WHERE id = ?").run(id);
      } else {
        const index = wallpapersStore.data.findIndex(w => w.id === id);
        if (index !== -1) {
          wallpapersStore.data.splice(index, 1);
          wallpapersStore.save();
        }
      }
    },
    updateWallpaperTags(id, tags) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE wallpapers SET tags = ? WHERE id = ?").run(JSON.stringify(tags), id);
      } else {
        const wp = wallpapersStore.data.find(w => w.id === id);
        if (wp) {
          wp.tags = tags;
          wallpapersStore.save();
        }
      }
    },
    updateWallpaper(id, w) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare(`
          UPDATE wallpapers
          SET title = ?, artist = ?, anime = ?, tags = ?, resolution = ?, fileSize = ?
          WHERE id = ?
        `).run(w.title, w.artist, w.anime, JSON.stringify(w.tags || []), w.resolution, w.fileSize, id);
      } else {
        const wp = wallpapersStore.data.find(x => x.id === id);
        if (wp) {
          wp.title = w.title || wp.title;
          wp.artist = w.artist || wp.artist;
          wp.anime = w.anime || wp.anime;
          wp.tags = w.tags || wp.tags;
          wp.resolution = w.resolution || wp.resolution;
          wp.fileSize = w.fileSize || wp.fileSize;
          wallpapersStore.save();
        }
      }
    },
    updateWallpaperRank(id, rank) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE wallpapers SET rank = ? WHERE id = ?").run(rank, id);
      } else {
        const wp = wallpapersStore.data.find(x => x.id === id);
        if (wp) {
          wp.rank = rank;
          wallpapersStore.save();
        }
      }
    },
    unpinWallpaperRank(id) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE wallpapers SET rank = 999 WHERE id = ?").run(id);
      } else {
        const wp = wallpapersStore.data.find(x => x.id === id);
        if (wp) {
          wp.rank = 999;
          wallpapersStore.save();
        }
      }
    }
  },

  users: {
    get data() {
      if (isSQLite && sqliteDb) {
        const rows = sqliteDb.prepare("SELECT * FROM users").all();
        return rows.map(r => ({
          ...r,
          likedArticles: JSON.parse(r.likedArticles || '[]'),
          savedArticles: JSON.parse(r.savedArticles || '[]')
        }));
      } else {
        return usersStore.data;
      }
    },
    save() {
      if (isSQLite) return true;
      return usersStore.save();
    },
    addUser(u) {
      if (isSQLite && sqliteDb) {
        const params = [
          u.username ?? null,
          u.fullName ?? null,
          u.email ?? null,
          u.salt ?? null,
          u.passwordHash ?? null,
          u.role ?? null,
          u.avatar ?? null,
          u.location ?? null,
          u.website ?? null,
          u.bio ?? null,
          u.language ?? null,
          u.timezone ?? null,
          JSON.stringify(u.likedArticles || []),
          JSON.stringify(u.savedArticles || [])
        ];
        sqliteDb.prepare(`
          INSERT INTO users (username, fullName, email, salt, passwordHash, role, avatar, location, website, bio, language, timezone, likedArticles, savedArticles)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...params);
      } else {
        usersStore.data.push(u);
        usersStore.save();
      }
    },
    updateUserProfile(originalUsername, u) {
      if (isSQLite && sqliteDb) {
        const params = [
          u.username ?? null,
          u.fullName ?? null,
          u.email ?? null,
          u.avatar ?? null,
          u.location ?? null,
          u.website ?? null,
          u.bio ?? null,
          u.language ?? null,
          u.timezone ?? null,
          JSON.stringify(u.likedArticles || []),
          JSON.stringify(u.savedArticles || []),
          u.recoveryToken ?? null,
          u.recoveryTokenExpiry ?? null,
          originalUsername
        ];
        const safeParams = params.map(val => val === undefined ? null : val);
        sqliteDb.prepare(`
          UPDATE users
          SET username = ?, fullName = ?, email = ?, avatar = ?, location = ?, website = ?, bio = ?, language = ?, timezone = ?,
              likedArticles = ?, savedArticles = ?, recoveryToken = ?, recoveryTokenExpiry = ?
          WHERE username = ?
        `).run(...safeParams);
      } else {
        usersStore.save();
      }
    },
    updateAuthCredentials(username, passwordHash, salt = null) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE users SET passwordHash = ?, salt = ? WHERE username = ?").run(passwordHash, salt, username);
      } else {
        const user = usersStore.data.find(x => x.username === username);
        if (user) {
          user.passwordHash = passwordHash;
          user.salt = salt;
          delete user.password;
          usersStore.save();
        }
      }
    },
    banUser(username) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE users SET role = 'Banned' WHERE username = ?").run(username);
      } else {
        const u = usersStore.data.find(x => x.username === username);
        if (u) {
          u.role = 'Banned';
          usersStore.save();
        }
      }
    },
    updateUserStatus(username, status) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare(`UPDATE users SET status = ? WHERE username = ?`).run(status, username);
      } else {
        const idx = usersStore.data.findIndex(user => user.username === username);
        if (idx !== -1) {
          usersStore.data[idx].status = status;
          usersStore.save();
        }
      }
    },
    deleteUser(username) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare(`DELETE FROM users WHERE username = ?`).run(username);
      } else {
        usersStore.data = usersStore.data.filter(user => user.username !== username);
        usersStore.save();
      }
    }
  },

  favorites: {
    getUserFavorites(sessionId) {
      if (isSQLite && sqliteDb) {
        const rows = sqliteDb.prepare("SELECT wallpaperId FROM favorites WHERE sessionId = ?").all(sessionId);
        return rows.map(r => r.wallpaperId);
      } else {
        return favoritesStore.data;
      }
    },
    toggleFavorite(sessionId, wallpaperId) {
      if (isSQLite && sqliteDb) {
        const exists = sqliteDb.prepare("SELECT 1 FROM favorites WHERE sessionId = ? AND wallpaperId = ?").get(sessionId, wallpaperId);
        if (exists) {
          sqliteDb.prepare("DELETE FROM favorites WHERE sessionId = ? AND wallpaperId = ?").run(sessionId, wallpaperId);
          return false;
        } else {
          sqliteDb.prepare("INSERT INTO favorites (sessionId, wallpaperId) VALUES (?, ?)").run(sessionId, wallpaperId);
          return true;
        }
      } else {
        const favSet = new Set(favoritesStore.data);
        let favorited = false;
        if (favSet.has(wallpaperId)) {
          favSet.delete(wallpaperId);
        } else {
          favSet.add(wallpaperId);
          favorited = true;
        }
        favoritesStore.data = Array.from(favSet);
        favoritesStore.save();
        return favorited;
      }
    },
    get data() {
      if (isSQLite && sqliteDb) {
        const rows = sqliteDb.prepare("SELECT wallpaperId FROM favorites").all();
        return rows.map(r => r.wallpaperId);
      } else {
        return favoritesStore.data;
      }
    },
    set data(val) {
      if (!isSQLite) {
        favoritesStore.data = val;
      }
    },
    save() {
      if (!isSQLite) {
        favoritesStore.save();
      }
    }
  },

  history: {
    getUserHistory(sessionId) {
      if (isSQLite && sqliteDb) {
        const rows = sqliteDb.prepare("SELECT wallpaperId as id, timestamp FROM history WHERE sessionId = ? ORDER BY id DESC").all(sessionId);
        return rows;
      } else {
        return historyStore.data;
      }
    },
    addHistory(sessionId, wallpaperId) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("DELETE FROM history WHERE sessionId = ? AND wallpaperId = ?").run(sessionId, wallpaperId);
        sqliteDb.prepare("INSERT INTO history (sessionId, wallpaperId, timestamp) VALUES (?, ?, ?)").run(sessionId, wallpaperId, new Date().toISOString());
      } else {
        const existingIndex = historyStore.data.findIndex(h => h.id === wallpaperId);
        if (existingIndex !== -1) {
          historyStore.data.splice(existingIndex, 1);
        }
        historyStore.data.unshift({ id: wallpaperId, timestamp: new Date().toISOString() });
        historyStore.save();
      }
    },
    clearHistory(sessionId) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("DELETE FROM history WHERE sessionId = ?").run(sessionId);
      } else {
        historyStore.data = [];
        historyStore.save();
      }
    },
    get data() {
      if (isSQLite && sqliteDb) {
        const rows = sqliteDb.prepare("SELECT wallpaperId as id, timestamp FROM history").all();
        return rows;
      } else {
        return historyStore.data;
      }
    },
    set data(val) {
      if (!isSQLite) {
        historyStore.data = val;
      }
    },
    save() {
      if (!isSQLite) {
        historyStore.save();
      }
    }
  },

  articles: {
    get data() {
      if (isSQLite && sqliteDb) {
        const rows = sqliteDb.prepare("SELECT * FROM articles").all();
        const arts = {};
        rows.forEach(r => {
          arts[r.id] = {
            ...r,
            paragraphs: JSON.parse(r.paragraphs || '[]'),
            commentsList: JSON.parse(r.commentsList || '[]')
          };
        });
        return arts;
      } else {
        return articlesStore.data;
      }
    },
    save() {
      if (isSQLite) return true;
      return articlesStore.save();
    },
    updateArticleEngagement(id, likes, commentsCount, commentsList) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE articles SET likes = ?, comments = ?, commentsList = ? WHERE id = ?").run(
          likes, commentsCount, JSON.stringify(commentsList || []), id
        );
      } else {
        articlesStore.save();
      }
    }
  },

  community: {
    get data() {
      if (isSQLite && sqliteDb) {
        const row = sqliteDb.prepare("SELECT value FROM community WHERE key = 'pulseStats'").get();
        return JSON.parse(row.value);
      } else {
        return communityStore.data;
      }
    },
    save(pulseData) {
      if (isSQLite && sqliteDb) {
        if (pulseData) {
          sqliteDb.prepare("UPDATE community SET value = ? WHERE key = 'pulseStats'").run(JSON.stringify(pulseData));
        }
      } else {
        communityStore.save();
      }
    }
  },

  dmca: {
    get data() {
      if (isSQLite && sqliteDb) {
        const rows = sqliteDb.prepare("SELECT * FROM dmca").all();
        return rows.map(r => ({
          ...r,
          files: JSON.parse(r.files || '[]')
        }));
      } else {
        return dmcaStore.data;
      }
    },
    save() {
      if (isSQLite) return true;
      return dmcaStore.save();
    },
    addRequest(d) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare(`
          INSERT INTO dmca (id, claimant, infringingUrl, allegationDescription, files, swearSignature, submittedAt, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(d.id, d.claimant || d.swearSignature, d.infringingUrl, d.allegationDescription, JSON.stringify(d.files || []), d.swearSignature, d.submittedAt, d.status);
      } else {
        dmcaStore.data.push(d);
        dmcaStore.save();
      }
    },
    updateStatus(id, status) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE dmca SET status = ? WHERE id = ?").run(status, id);
      } else {
        const d = dmcaStore.data.find(x => x.id === id);
        if (d) {
          d.status = status;
          dmcaStore.save();
        }
      }
    }
  },
  reports: {
    get data() {
      if (isSQLite && sqliteDb) {
        const rows = sqliteDb.prepare("SELECT * FROM reports").all();
        return rows.map(r => ({
          ...r,
          ledger: JSON.parse(r.ledger || '[]'),
          context: JSON.parse(r.context || '{}'),
          metrics: JSON.parse(r.metrics || '{}')
        }));
      } else {
        return reportsStore.data;
      }
    },
    save() {
      if (isSQLite) return true;
      return reportsStore.save();
    },
    updateStatus(id, status) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("UPDATE reports SET status = ? WHERE id = ?").run(status, id);
      } else {
        const r = reportsStore.data.find(x => x.id === id);
        if (r) {
          r.status = status;
          reportsStore.save();
        }
      }
    },
    delete(id) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("DELETE FROM reports WHERE id = ?").run(id);
      } else {
        reportsStore.data = reportsStore.data.filter(x => x.id !== id);
        reportsStore.save();
      }
    }
  },
  documents: {
    getAll() {
      if (isSQLite && sqliteDb) {
        try {
          const rows = sqliteDb.prepare("SELECT * FROM documents ORDER BY lastModified DESC").all();
          return rows.map(r => ({
            ...r,
            tags: JSON.parse(r.tags || '[]')
          }));
        } catch(e) {
          console.error("[DATABASE] Error reading documents:", e);
          return [];
        }
      } else {
        return documentsStore.data;
      }
    },
    getById(id) {
      if (isSQLite && sqliteDb) {
        try {
          const row = sqliteDb.prepare("SELECT * FROM documents WHERE id = ?").get(id);
          if (row) {
            row.tags = JSON.parse(row.tags || '[]');
          }
          return row;
        } catch(e) {
          console.error("[DATABASE] Error reading document by ID:", e);
          return null;
        }
      } else {
        return documentsStore.data.find(d => d.id === id);
      }
    },
    addDocument(doc) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare(`
          INSERT INTO documents (id, title, author, status, lastModified, content, coverAsset, urlSlug, excerpt, tags)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(doc.id, doc.title, doc.author, doc.status, doc.lastModified, doc.content, doc.coverAsset, doc.urlSlug, doc.excerpt, JSON.stringify(doc.tags || []));
      } else {
        documentsStore.data.unshift(doc);
        documentsStore.save();
      }
    },
    updateDocument(id, updates) {
      if (isSQLite && sqliteDb) {
        const current = this.getById(id);
        if (!current) return;
        const allowed = ['title', 'author', 'status', 'lastModified', 'content', 'coverAsset', 'urlSlug', 'excerpt', 'tags'];
        const safeUpdates = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
        const nextDoc = { ...current, ...safeUpdates };
        sqliteDb.prepare(`
          UPDATE documents
          SET title = ?, author = ?, status = ?, lastModified = ?, content = ?, coverAsset = ?, urlSlug = ?, excerpt = ?, tags = ?
          WHERE id = ?
        `).run(
          nextDoc.title,
          nextDoc.author,
          nextDoc.status,
          nextDoc.lastModified,
          nextDoc.content,
          nextDoc.coverAsset,
          nextDoc.urlSlug,
          nextDoc.excerpt,
          JSON.stringify(nextDoc.tags || []),
          id
        );
      } else {
        const index = documentsStore.data.findIndex(d => d.id === id);
        if (index !== -1) {
          const allowed = ['title', 'author', 'status', 'lastModified', 'content', 'coverAsset', 'urlSlug', 'excerpt', 'tags'];
          const safeUpdates = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
          documentsStore.data[index] = { ...documentsStore.data[index], ...safeUpdates };
          documentsStore.save();
        }
      }
    },
    deleteDocument(id) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("DELETE FROM documents WHERE id = ?").run(id);
      } else {
        documentsStore.data = documentsStore.data.filter(d => d.id !== id);
        documentsStore.save();
      }
    }
  },
  collections: {
    getAll() {
      if (isSQLite && sqliteDb) {
        try {
          const rows = sqliteDb.prepare("SELECT * FROM collections ORDER BY createdAt DESC").all();
          return rows.map(r => ({
            ...r,
            assets: JSON.parse(r.assets || '[]'),
            featured: !!r.featured,
            isDraft: !!r.isDraft
          }));
        } catch(e) {
          console.error("[DATABASE] Error reading collections:", e);
          return [];
        }
      } else {
        return collectionsStore.data;
      }
    },
    getById(id) {
      if (isSQLite && sqliteDb) {
        try {
          const row = sqliteDb.prepare("SELECT * FROM collections WHERE id = ?").get(id);
          if (row) {
            row.assets = JSON.parse(row.assets || '[]');
            row.featured = !!row.featured;
            row.isDraft = !!row.isDraft;
          }
          return row;
        } catch(e) {
          console.error("[DATABASE] Error reading collection by ID:", e);
          return null;
        }
      } else {
        return collectionsStore.data.find(c => c.id === id);
      }
    },
    addCollection(col) {
      if (isSQLite && sqliteDb) {
        try {
          sqliteDb.prepare(`
            INSERT INTO collections (id, title, description, coverImage, assets, featured, isDraft, createdAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            col.id,
            col.title,
            col.description,
            col.coverImage,
            JSON.stringify(col.assets || []),
            col.featured ? 1 : 0,
            col.isDraft ? 1 : 0,
            col.createdAt
          );
        } catch(e) {
          console.error("[DATABASE] Error writing collection:", e);
        }
      } else {
        collectionsStore.data.push(col);
        collectionsStore.save();
      }
    },
    updateCollection(id, updates) {
      if (isSQLite && sqliteDb) {
        try {
          const current = this.getById(id);
          if (!current) return;
          const allowed = ['title', 'description', 'coverImage', 'assets', 'featured', 'isDraft', 'createdAt'];
          const safeUpdates = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
          const nextCollection = { ...current, ...safeUpdates };
          sqliteDb.prepare(`
            UPDATE collections
            SET title = ?, description = ?, coverImage = ?, assets = ?, featured = ?, isDraft = ?, createdAt = ?
            WHERE id = ?
          `).run(
            nextCollection.title,
            nextCollection.description,
            nextCollection.coverImage,
            JSON.stringify(nextCollection.assets || []),
            nextCollection.featured ? 1 : 0,
            nextCollection.isDraft ? 1 : 0,
            nextCollection.createdAt,
            id
          );
        } catch(e) {
          console.error("[DATABASE] Error updating collection:", e);
        }
      } else {
        const index = collectionsStore.data.findIndex(c => c.id === id);
        if (index !== -1) {
          const allowed = ['title', 'description', 'coverImage', 'assets', 'featured', 'isDraft', 'createdAt'];
          const safeUpdates = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
          collectionsStore.data[index] = { ...collectionsStore.data[index], ...safeUpdates };
          collectionsStore.save();
        }
      }
    },
    deleteCollection(id) {
      if (isSQLite && sqliteDb) {
        sqliteDb.prepare("DELETE FROM collections WHERE id = ?").run(id);
      } else {
        collectionsStore.data = collectionsStore.data.filter(c => c.id !== id);
        collectionsStore.save();
      }
    }
  },
  categories: {
    getAll() {
      if (isSQLite && sqliteDb) {
        try {
          return sqliteDb.prepare("SELECT * FROM categories").all();
        } catch(e) {
          console.error("[DATABASE] Error reading categories:", e);
          return categoriesStore.data;
        }
      } else {
        return categoriesStore.data;
      }
    },
    create(c) {
      if (isSQLite && sqliteDb) {
        try {
          const res = sqliteDb.prepare(`
            INSERT INTO categories (name, slug, description)
            VALUES (?, ?, ?)
          `).run(c.name, c.slug, c.description);
          return { id: res.lastInsertRowid, ...c };
        } catch(e) {
          console.error("[DATABASE] Error creating category:", e);
          return null;
        }
      } else {
        const id = categoriesStore.data.reduce((max, cat) => cat.id > max ? cat.id : max, 0) + 1;
        const newCat = { id, ...c };
        categoriesStore.data.push(newCat);
        categoriesStore.save();
        return newCat;
      }
    },
    update(id, updates) {
      if (isSQLite && sqliteDb) {
        try {
          const current = sqliteDb.prepare("SELECT * FROM categories WHERE id = ?").get(id);
          if (!current) return false;
          const allowed = ['name', 'slug', 'description'];
          const safeUpdates = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
          const nextCategory = { ...current, ...safeUpdates };
          sqliteDb.prepare(`
            UPDATE categories
            SET name = ?, slug = ?, description = ?
            WHERE id = ?
          `).run(nextCategory.name, nextCategory.slug, nextCategory.description, id);
          return true;
        } catch(e) {
          console.error("[DATABASE] Error updating category:", e);
          return false;
        }
      } else {
        const index = categoriesStore.data.findIndex(c => c.id === parseInt(id));
        if (index !== -1) {
          const allowed = ['name', 'slug', 'description'];
          const safeUpdates = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
          categoriesStore.data[index] = { ...categoriesStore.data[index], ...safeUpdates };
          categoriesStore.save();
          return true;
        }
        return false;
      }
    },
    delete(id) {
      if (isSQLite && sqliteDb) {
        try {
          sqliteDb.prepare("DELETE FROM categories WHERE id = ?").run(id);
          return true;
        } catch(e) {
          console.error("[DATABASE] Error deleting category:", e);
          return false;
        }
      } else {
        categoriesStore.data = categoriesStore.data.filter(c => c.id !== parseInt(id));
        return categoriesStore.save();
      }
    }
  },
  media: {
    getAll() {
      if (isSQLite && sqliteDb) {
        try {
          return sqliteDb.prepare("SELECT * FROM media ORDER BY id DESC").all();
        } catch(e) {
          console.error("[DATABASE] Error reading media:", e);
          return mediaStore.data;
        }
      } else {
        return mediaStore.data;
      }
    },
    create(m) {
      if (isSQLite && sqliteDb) {
        try {
          const res = sqliteDb.prepare(`
            INSERT INTO media (filename, url, mimeType, size, uploadedAt)
            VALUES (?, ?, ?, ?, ?)
          `).run(m.filename, m.url, m.mimeType, m.size, m.uploadedAt);
          return { id: res.lastInsertRowid, ...m };
        } catch(e) {
          console.error("[DATABASE] Error inserting media:", e);
          return null;
        }
      } else {
        const id = mediaStore.data.reduce((max, med) => med.id > max ? med.id : max, 0) + 1;
        const newMed = { id, ...m };
        mediaStore.data.unshift(newMed);
        mediaStore.save();
        return newMed;
      }
    },
    delete(id) {
      if (isSQLite && sqliteDb) {
        try {
          sqliteDb.prepare("DELETE FROM media WHERE id = ?").run(id);
          return true;
        } catch(e) {
          console.error("[DATABASE] Error deleting media:", e);
          return false;
        }
      } else {
        mediaStore.data = mediaStore.data.filter(m => m.id !== parseInt(id));
        return mediaStore.save();
      }
    },
    getById(id) {
      if (isSQLite && sqliteDb) {
        try {
          return sqliteDb.prepare("SELECT * FROM media WHERE id = ?").get(id);
        } catch(e) {
          console.error("[DATABASE] Error reading media by id:", e);
          return null;
        }
      } else {
        return mediaStore.data.find(m => m.id === parseInt(id));
      }
    }
  },
  settings: {
    getAll() {
      if (isSQLite && sqliteDb) {
        try {
          const rows = sqliteDb.prepare("SELECT key, value FROM system_settings").all();
          const settings = {};
          rows.forEach(row => {
            try {
              settings[row.key] = JSON.parse(row.value);
            } catch(e) {
              settings[row.key] = row.value;
            }
          });
          return settings;
        } catch(e) {
          console.error("[DATABASE] Error reading system settings:", e);
          return systemSettingsStore.data;
        }
      } else {
        return systemSettingsStore.data;
      }
    },
    update(settingsObj) {
      if (isSQLite && sqliteDb) {
        try {
          const insertStmt = sqliteDb.prepare("INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)");
          sqliteDb.exec("BEGIN");
          try {
            for (const key in settingsObj) {
              insertStmt.run(key, JSON.stringify(settingsObj[key]));
            }
            sqliteDb.exec("COMMIT");
          } catch(txnErr) {
            sqliteDb.exec("ROLLBACK");
            throw txnErr;
          }
          return true;
        } catch(e) {
          console.error("[DATABASE] Error updating system settings:", e);
          return false;
        }
      } else {
        systemSettingsStore.data = { ...systemSettingsStore.data, ...settingsObj };
        return systemSettingsStore.save();
      }
    }
  },
  admin: {
    getAuditLogs() {
      if (isSQLite && sqliteDb) {
        try {
          const rows = sqliteDb.prepare("SELECT * FROM admin_audit_logs ORDER BY id DESC").all();
          return rows.map(r => ({
            ...r,
            details: JSON.parse(r.details || '{}')
          }));
        } catch(e) {
          console.error("[DATABASE] Error reading audit logs:", e);
          return [];
        }
      } else {
        if (!global.adminAuditLogsMem) {
          const path = require('path');
          const fs = require('fs');
          const logsPath = path.join(__dirname, 'data', 'admin_audit_logs.json');
          try {
            if (fs.existsSync(logsPath)) {
              global.adminAuditLogsMem = JSON.parse(fs.readFileSync(logsPath, 'utf8'));
            } else {
              global.adminAuditLogsMem = [];
            }
          } catch(e) {
            global.adminAuditLogsMem = [];
          }
        }
        return global.adminAuditLogsMem;
      }
    },
    addAuditLog(action, adminEmail, details) {
      const timestamp = new Date().toISOString();
      if (isSQLite && sqliteDb) {
        try {
          sqliteDb.prepare(`
            INSERT INTO admin_audit_logs (action, adminEmail, timestamp, details)
            VALUES (?, ?, ?, ?)
          `).run(action, adminEmail, timestamp, JSON.stringify(details || {}));
        } catch(e) {
          console.error("[DATABASE] Error writing audit log:", e);
        }
      } else {
        if (!global.adminAuditLogsMem) this.getAuditLogs();
        const newLog = {
          id: global.adminAuditLogsMem.length + 1,
          action,
          adminEmail,
          timestamp,
          details
        };
        global.adminAuditLogsMem.unshift(newLog);
        const path = require('path');
        const fs = require('fs');
        const logsPath = path.join(__dirname, 'data', 'admin_audit_logs.json');
        try {
          fs.writeFileSync(logsPath, JSON.stringify(global.adminAuditLogsMem, null, 2), 'utf8');
        } catch(e) {
          console.error("[DATABASE] Error saving audit log JSON:", e);
        }
      }
    }
  },
  announcements: {
    getAll() {
      if (isSQLite && sqliteDb) {
        try {
          return sqliteDb.prepare("SELECT * FROM announcements ORDER BY id DESC").all();
        } catch (e) {
          console.error("[DATABASE] Error reading announcements:", e);
          return announcementsStore.data;
        }
      } else {
        return announcementsStore.data;
      }
    },
    create(a) {
      if (isSQLite && sqliteDb) {
        try {
          const res = sqliteDb.prepare(`
            INSERT INTO announcements (title, body, type, isPinned, createdAt)
            VALUES (?, ?, ?, ?, ?)
          `).run(a.title, a.body, a.type, a.isPinned ? 1 : 0, a.createdAt);
          return { id: res.lastInsertRowid, ...a };
        } catch (e) {
          console.error("[DATABASE] Error inserting announcement:", e);
          return null;
        }
      } else {
        const id = announcementsStore.data.reduce((max, ann) => ann.id > max ? ann.id : max, 0) + 1;
        const newAnn = { id, ...a };
        announcementsStore.data.unshift(newAnn);
        announcementsStore.save();
        return newAnn;
      }
    }
  },
  supportTickets: {
    getAll() {
      if (isSQLite && sqliteDb) {
        try {
          const rows = sqliteDb.prepare("SELECT * FROM support_tickets").all();
          return rows.map(r => ({
            ...r,
            messages: JSON.parse(r.messages || '[]')
          }));
        } catch (e) {
          console.error("[DATABASE] Error reading support tickets:", e);
          return supportTicketsStore.data;
        }
      } else {
        return supportTicketsStore.data;
      }
    },
    update(id, updates) {
      if (isSQLite && sqliteDb) {
        try {
          const current = sqliteDb.prepare("SELECT * FROM support_tickets WHERE id = ?").get(id);
          if (!current) return false;
          const allowed = ['status', 'messages', 'time'];
          const safeUpdates = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
          const nextTicket = { ...current, ...safeUpdates };
          sqliteDb.prepare(`
            UPDATE support_tickets
            SET status = ?, messages = ?, time = ?
            WHERE id = ?
          `).run(
            nextTicket.status,
            typeof nextTicket.messages === 'string' ? nextTicket.messages : JSON.stringify(nextTicket.messages || []),
            nextTicket.time,
            id
          );
          return true;
        } catch (e) {
          console.error("[DATABASE] Error updating support ticket:", e);
          return false;
        }
      } else {
        const index = supportTicketsStore.data.findIndex(t => t.id === id);
        if (index !== -1) {
          const allowed = ['status', 'messages', 'time'];
          const safeUpdates = Object.fromEntries(Object.entries(updates || {}).filter(([key]) => allowed.includes(key)));
          supportTicketsStore.data[index] = { ...supportTicketsStore.data[index], ...safeUpdates };
          supportTicketsStore.save();
          return true;
        }
        return false;
      }
    }
  }
};

function migrateLegacyPasswordStorage() {
  if (isSQLite && sqliteDb) {
    const rows = sqliteDb.prepare("SELECT username, salt, passwordHash FROM users").all();
    const update = sqliteDb.prepare("UPDATE users SET passwordHash = ? WHERE username = ?");
    rows.forEach(user => {
      if (user.salt && user.passwordHash && !isBcryptHash(user.passwordHash)) {
        update.run(wrapLegacyHashForStorage(user.salt, user.passwordHash), user.username);
      }
    });
  }

  let changed = false;
  usersStore.data.forEach(user => {
    if (!user.passwordHash && getSeedPassword()) {
      const hashed = hashPassword(getSeedPassword());
      user.salt = hashed.salt;
      user.passwordHash = hashed.hash;
      changed = true;
    }
    if (user.salt && user.passwordHash && !isBcryptHash(user.passwordHash)) {
      user.passwordHash = wrapLegacyHashForStorage(user.salt, user.passwordHash);
      changed = true;
    }
    if (user.password) {
      const hashed = hashPassword(user.password);
      user.salt = hashed.salt;
      user.passwordHash = hashed.hash;
      delete user.password;
      changed = true;
    }
  });
  if (changed) {
    usersStore.save();
  }
}

migrateLegacyPasswordStorage();

module.exports = db;
