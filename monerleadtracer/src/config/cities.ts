import type { CityPreset, CityPresetId } from '@/lib/types';

/**
 * Presety miast.
 *
 * Domyślny start to `srednie`, nie `duze`, i to jest świadoma decyzja:
 * w Warszawie do tej samej cukierni dzwoniło przed tobą pięć agencji.
 * W Radomiu czy Tarnowie zimny kontakt wciąż ma szansę, bo nikt tam nie zagląda.
 */
export const CITY_PRESETS: Record<CityPresetId, CityPreset> = {
  srednie: {
    id: 'srednie',
    label: 'Średnie miasta',
    description: 'Mniejsza konkurencja agencji, wyższa odpowiedź na zimny kontakt',
    cities: [
      'Radom',
      'Kielce',
      'Częstochowa',
      'Tarnów',
      'Nowy Sącz',
      'Płock',
      'Elbląg',
      'Legnica',
      'Wałbrzych',
      'Olsztyn',
      'Rzeszów',
      'Białystok',
    ],
  },
  duze: {
    id: 'duze',
    label: 'Duże miasta',
    description: 'Największy wolumen leadów, ale najwięcej agencji dzwoni tam przed tobą',
    cities: [
      'Warszawa',
      'Kraków',
      'Wrocław',
      'Poznań',
      'Łódź',
      'Gdańsk',
      'Szczecin',
      'Katowice',
    ],
  },
  aglomeracje: {
    id: 'aglomeracje',
    label: 'Aglomeracje',
    description: 'Trójmiasto, Śląsk i obwarzanek warszawski',
    cities: [
      'Gdynia',
      'Sopot',
      'Gliwice',
      'Zabrze',
      'Bytom',
      'Sosnowiec',
      'Tychy',
      'Pruszków',
      'Piaseczno',
      'Legionowo',
      'Wołomin',
      'Otwock',
    ],
  },
};

export const DEFAULT_CITY_PRESET: CityPresetId = 'srednie';

export const CITY_PRESET_ORDER: CityPresetId[] = ['srednie', 'duze', 'aglomeracje'];

export function citiesForPreset(id: CityPresetId): string[] {
  return CITY_PRESETS[id]?.cities ?? [];
}
