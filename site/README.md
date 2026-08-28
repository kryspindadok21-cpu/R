# Strona testowa projektu

Statyczna strona publikowana na GitHub Pages pod adresem
`https://kryspindadok21-cpu.github.io/R/`.

**Po co istnieje:** żeby narzędzie z tego repozytorium miało prawdziwy serwis
do przejścia — z HTTPS, mapą witryny, linkowaniem wewnętrznym i treścią.
Bez tego crawl i audyt da się sprawdzić wyłącznie na atrapach.

## Co warto wiedzieć o tym adresie

- Strona stoi **w katalogu** `/R/` na współdzielonym hoście `github.io`.
  Obok stoją projekty innych osób. Crawler tego projektu zostaje w swoim
  katalogu — to jest zachowanie sprawdzane testem, nie założenie.
- `robots.txt` w tym katalogu **nie działa jak robots.txt**. Wyszukiwarki
  czytają go wyłącznie z korzenia hosta, czyli `github.io/robots.txt`, a tego
  pliku nie kontrolujemy. Leży tu, bo dokumentuje intencję i bo narzędzie
  potrafi go znaleźć pod prefiksem.
- `sitemap.xml` **działa** — wystarczy zgłosić go wprost w Search Console.

## Publikacja

Katalog wypycha workflow `.github/workflows/strona.yml` przy każdej zmianie
w `site/`. Nic nie trzeba budować — to czysty HTML i jeden arkusz stylów.

**Jednorazowe włączenie po stronie właściciela repozytorium.** Token workflow
nie ma prawa włączyć Pages (API odpowiada `Resource not accessible by
integration`), więc trzeba to zrobić ręcznie raz:

1. `Settings` → `Pages` → `Source`: **GitHub Actions**.
2. Jeśli wdrożenie zostanie odrzucone z powodu gałęzi, ustaw gałąź roboczą jako
   domyślną (`Settings` → `General` → `Default branch`) albo dopuść ją
   w `Settings` → `Environments` → `github-pages`.

## Zasady, których ta strona pilnuje sama na sobie

Zero zasobów z sieci: fonty systemowe, brak bibliotek, brak śledzenia.
Jeden `<h1>` na stronę, nagłówki bez przeskoków, pierwszy akapit odpowiada
wprost na pytanie z nagłówka. To nie jest ozdoba — to są reguły, które
narzędzie z tego repozytorium sprawdza, więc strona ma je spełniać.
