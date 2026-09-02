import type { Niche, NicheId } from '@/lib/types';

/**
 * Nisze uszeregowane wg tego, jak łatwo sprzedać w nich stronę za ~890 zł.
 *
 * Kolejność nie jest przypadkowa — to ranking z planu:
 *  1. beauty      — najwięcej mikrofirm, ogromna część tylko na Booksy/Instagramie,
 *                   decyduje jedna osoba, opinie świeże i pełne konkretów
 *  2. auto        — właściciel odbiera telefon, wysoka wartość klienta, agencje tam nie dzwonią
 *  3. gastro      — najlepsze cytaty z opinii, ale trudno złapać właściciela w godzinach pracy
 *  4. budowlanka  — najwyższa wartość leada, najtrudniejszy kontakt (pod telefon, nie pod DM)
 *
 * `reviewKeywords` to słownik, z którego copywriter wyłuskuje hook z opinii.
 * Dopisanie słowa tutaj natychmiast poprawia personalizację w całej niszy.
 */
export const NICHES: Record<NicheId, Niche> = {
  beauty: {
    id: 'beauty',
    label: 'Beauty / barber',
    scoreWeight: 20,
    queries: [
      'salon paznokci',
      'barber shop',
      'salon fryzjerski',
      'salon kosmetyczny',
      'stylizacja rzęs',
      'brwi i rzęsy',
      'depilacja laserowa',
      'masaż i spa',
    ],
    reviewKeywords: [
      'paznokcie',
      'manicure',
      'pedicure',
      'hybryda',
      'rzęsy',
      'brwi',
      'strzyżenie',
      'fryzura',
      'koloryzacja',
      'balejaż',
      'broda',
      'masaż',
      'zabieg',
      'makijaż',
      'depilacja',
      'oczyszczanie',
    ],
    placeTypes: [
      'beauty_salon',
      'hair_salon',
      'nail_salon',
      'barber_shop',
      'spa',
      'hair_care',
    ],
  },

  auto: {
    id: 'auto',
    label: 'Warsztaty / auto',
    scoreWeight: 20,
    queries: [
      'warsztat samochodowy',
      'mechanik samochodowy',
      'wulkanizacja',
      'auto detailing',
      'blacharstwo lakiernictwo',
      'elektryk samochodowy',
      'wymiana oleju',
      'klimatyzacja samochodowa',
    ],
    reviewKeywords: [
      'naprawa',
      'diagnostyka',
      'wymiana',
      'opony',
      'hamulce',
      'rozrząd',
      'zawieszenie',
      'lakierowanie',
      'polerowanie',
      'przegląd',
      'silnik',
      'sprzęgło',
      'klimatyzacja',
      'blacharka',
    ],
    placeTypes: [
      'car_repair',
      'car_wash',
      'auto_parts_store',
      'car_dealer',
      'tire_shop',
    ],
  },

  gastro: {
    id: 'gastro',
    label: 'Gastronomia',
    scoreWeight: 20,
    queries: [
      'restauracja',
      'kawiarnia',
      'cukiernia',
      'pizzeria',
      'bar mleczny',
      'catering dietetyczny',
      'food truck',
      'lodziarnia',
      'piekarnia',
    ],
    reviewKeywords: [
      'pizza',
      'tarty',
      'tarta',
      'ciasto',
      'ciasta',
      'sernik',
      'szarlotka',
      'burger',
      'pierogi',
      'obiad',
      'kawa',
      'lody',
      'chleb',
      'deser',
      'zupa',
      'ramen',
      'sushi',
      'obsługa',
      'atmosfera',
      'porcje',
    ],
    placeTypes: [
      'restaurant',
      'cafe',
      'bakery',
      'meal_takeaway',
      'meal_delivery',
      'ice_cream_shop',
      'coffee_shop',
      'pizza_restaurant',
    ],
  },

  budowlanka: {
    id: 'budowlanka',
    label: 'Budowlanka / instalacje',
    scoreWeight: 20,
    queries: [
      'remonty mieszkań',
      'wykończenia wnętrz',
      'hydraulik',
      'elektryk',
      'usługi budowlane',
      'ogrodzenia montaż',
      'pompy ciepła montaż',
      'stolarz meble na wymiar',
    ],
    reviewKeywords: [
      'remont',
      'wykończenie',
      'łazienka',
      'kuchnia',
      'instalacja',
      'montaż',
      'glazura',
      'malowanie',
      'gładzie',
      'ogrzewanie',
      'terminowo',
      'solidnie',
      'kosztorys',
      'ekipa',
    ],
    placeTypes: [
      'general_contractor',
      'plumber',
      'electrician',
      'painter',
      'roofing_contractor',
      'carpenter',
    ],
  },

  zdrowie: {
    id: 'zdrowie',
    label: 'Zdrowie / usługi medyczne',
    scoreWeight: 16,
    queries: [
      'fizjoterapeuta',
      'gabinet stomatologiczny',
      'weterynarz',
      'psycholog gabinet',
      'dietetyk',
      'optyk',
    ],
    reviewKeywords: [
      'rehabilitacja',
      'zabieg',
      'wizyta',
      'leczenie',
      'terapia',
      'diagnoza',
      'kręgosłup',
      'masaż leczniczy',
    ],
    placeTypes: [
      'physiotherapist',
      'dentist',
      'veterinary_care',
      'doctor',
      'medical_clinic',
    ],
  },

  edukacja: {
    id: 'edukacja',
    label: 'Edukacja / opieka',
    scoreWeight: 16,
    queries: [
      'szkoła jazdy',
      'przedszkole prywatne',
      'żłobek prywatny',
      'szkoła językowa',
      'korepetycje',
      'trener personalny',
    ],
    reviewKeywords: [
      'kurs',
      'zajęcia',
      'instruktor',
      'egzamin',
      'nauczyciel',
      'dzieci',
      'trening',
      'lekcje',
    ],
    placeTypes: [
      'driving_school',
      'preschool',
      'school',
      'gym',
      'child_care_agency',
    ],
  },

  handel: {
    id: 'handel',
    label: 'Handel detaliczny',
    scoreWeight: 10,
    queries: ['kwiaciarnia', 'sklep zoologiczny', 'sklep rowerowy', 'antykwariat'],
    reviewKeywords: ['bukiet', 'kwiaty', 'wybór', 'asortyment', 'ceny', 'obsługa'],
    placeTypes: ['florist', 'pet_store', 'bicycle_store', 'store', 'book_store'],
  },

  inne: {
    id: 'inne',
    label: 'Inne',
    scoreWeight: 6,
    queries: [],
    reviewKeywords: [],
    placeTypes: [],
  },
};

/** Kolejność wyświetlania w UI — od najlepiej konwertujących. */
export const NICHE_ORDER: NicheId[] = [
  'beauty',
  'auto',
  'gastro',
  'budowlanka',
  'zdrowie',
  'edukacja',
  'handel',
  'inne',
];

/** Nisze uruchamiane przyciskiem „Rekomendowany start". */
export const RECOMMENDED_NICHES: NicheId[] = ['beauty', 'auto'];

/** Mapuje typy Google Places na naszą niszę. Pierwsze trafienie wygrywa. */
export function nicheFromPlaceTypes(types: string[]): NicheId {
  const set = new Set(types);
  for (const id of NICHE_ORDER) {
    if (id === 'inne') continue;
    if (NICHES[id].placeTypes.some((t) => set.has(t))) return id;
  }
  return 'inne';
}

export function nicheLabel(id: NicheId): string {
  return NICHES[id]?.label ?? id;
}
