# Hemkoll

Egen app för att se och styra hemmet: elförbrukning i realtid (Tibber Pulse), dagens
elpris, uttag (Deltaco, IKEA, Shelly), Sonos, Apple TV, Google TV, Google Home,
PlayStation och datorer. Allt går via **Home Assistant**, så appen pratar bara med ett API.

## Kom igång (demoläge – ingen hårdvara behövs)

```bash
npm install
npm run dev
```

Öppna adressen som visas (även från mobilen på samma wifi). Appen startar i **demoläge**
med låtsasdata för dina prylar.

## Koppla mot riktiga Home Assistant

1. Installera Home Assistant (Green) och lägg till integrationerna:
   **Tibber**, **Shelly**, **IKEA (Matter/Dirigera)**, **Tuya** (Deltaco), **Sonos**,
   **Apple TV**, **Android TV Remote** (Google TV), **Google Cast**,
   **PlayStation Network**, **Wake on LAN**.
2. Profil → Säkerhet → *Långlivade åtkomsttoken* → skapa en token.
3. I appen: Inställningar → fyll i adress + token → Anslut.
4. Justera `src/config.ts` om något inte hittas automatiskt (t.ex. sensorerna för tvättmaskin och torktumlare,
   uttag som ska döljas eller aldrig stängas av).

### Köra appen från Home Assistant (rekommenderat)

```bash
npm run build
# kopiera innehållet i dist/ till /config/www/hemkoll/ på HA (Samba- eller File editor-tillägget)
```

Öppna `http://homeassistant.local:8123/local/hemkoll/index.html` och lägg till på hemskärmen.
Då behöver du bara klistra in token första gången, och adressen fylls i automatiskt.

## Styra enheter

Tryck på en högtalare, TV eller konsol under **Enheter** för att öppna kontrollvyn:

- **Sonos:** spela/pausa/nästa, volym, mute, favoriter (Sonos-favoriter visas automatiskt) och *Spela även i* för att gruppera rum.
- **Apple TV:** fjärrkontroll (piltangenter, OK, Tillbaka, Hem, volym) och appar.
- **Google TV:** samma fjärrkontroll plus snabbknappar för appar (`config.tvApps`).
- **Google Home:** spela/pausa, volym.
- **PlayStation:** status via PSN. På/av kräver tillägget PS5-MQTT och `config.consolePower`.

Fjärrkontrollen kräver att `remote.*`-entiteten finns. Den skapas automatiskt av integrationerna Apple TV och Android TV Remote.

## Tvättstugan → Sonos

`homeassistant/packages/hemkoll_tvattstuga.yaml` innehåller automationerna "Tvätten är klar" och "Torken är klar" (en Shelly Plug PM Gen3 per maskin). Instruktioner står överst i filen. Sensornamnen ställs in i `config.appliances` i `src/config.ts`.

## Struktur

```
src/
  config.ts            ← dina entity_id:n och överstyrningar
  ha/HassProvider.tsx  ← WebSocket-anslutning + demoläge
  ha/selectors.ts      ← hittar Tibber, uttag, media, datorer automatiskt
  ha/mock.ts           ← demodata
  components/          ← elprisgraf, enhetsrutor
  pages/               ← Översikt, Enheter, Inställningar
homeassistant/packages ← automationer att lägga i HA
```

## Att tänka på

- **"Stäng av allt"** stänger av alla uttag som är på. Lägg kyl, frys och router i
  `config.hidden` eller använd en Shelly Plug PM (har ingen strömbrytare).
- Tibber har kvartspriser, och grafen hanterar både 15- och 60-minutersintervall.
