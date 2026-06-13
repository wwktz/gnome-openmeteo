/*
    SPDX-License-Identifier: GPL-3.0-or-later

    Open-Meteo GNOME Extension
    Weather data provided by Open-Meteo

    Copyright 2022 Jason Oickle
    Copyright 2026 Weikang Wang

*/
import { gettext as _ } from "resource:///org/gnome/shell/extensions/extension.js";
import GLib from "gi://GLib";

import { getCachedLocInfo, getLocationInfo } from "./myloc.js";
import { getWeatherInfo} from "./getweather.js";

const _debugLogging = GLib.getenv("OPENMETEO_DEBUG") === "1";

function debugWarn(message) {
  if (_debugLogging) console.warn(message);
}

function debugError(error) {
  if (_debugLogging) console.error(error);
}

async function initWeatherData(refresh) {
  if (refresh) {
    this._lastRefresh = Date.now();
  }
  try {
    await this.refreshWeatherData().then(async () => {
      try 
      {
        if(this._city.isMyLoc())
        {
          await getLocationInfo(this.settings);
        }
        this.recalcLayout();

      } catch (e) {
        debugError(e);
      }
    });
  } catch (e) {
    debugError(e);
  }
}

async function reloadWeatherCache()
{
  try
  {
    await this.populateCurrentUI();
    if (!this._isForecastDisabled)
    {
      await this.populateTodaysUI();
      await this.populateForecastUI();
      this.recalcLayout();
    }
  }
  catch (e)
  {
    debugError(e);
  }
}

async function refreshWeatherData()
{
  try
  {
    let weather;
    try
    {
      weather = await getWeatherInfo(this, _);
    }
    catch (e)
    {
      debugError(e);
      this.reloadWeatherCurrent(600);
      return;
    }

    if(!weather)
    {
      debugWarn("Open-Meteo: getWeatherInfo failed without an error.");
      // Try reloading after 10 minutes
      this.reloadWeatherCurrent(600);
      return;
    }

    this.currentWeatherCache = weather;

    await this.populateCurrentUI();
    await this.populateTodaysUI();
    await this.populateForecastUI();
    this.reloadWeatherCurrent(this._refresh_interval_current);
  }
  catch(e)
  {
    debugError(`Open-Meteo: ${e}`);
    debugError(e.stack);
  }
}

function populateCurrentUI()
{
  return new Promise((resolve, reject) =>
  {
    try
    {
      /** @type {(Weather | null)} */
      let w = this.currentWeatherCache;
      if(!w) reject("Open-Meteo: No weather cached.");

      let location = this._city.getName(_);
      if(this._city.isMyLoc())
      {
        let locObj = getCachedLocInfo();
        let cityName = locObj.city;
        if(cityName === "Unknown") cityName = _("Unknown");
        location += ` (${cityName})`; }

      let iconName = w.getIconName();
      this._currentWeatherIcon.set_gicon(this.getGIcon(iconName));
      this._weatherIcon.set_gicon(this.getGIcon(iconName));

      let sunrise = w.getSunriseDate();
      let sunset = w.getSunsetDate();
      let lastBuild = new Date();

      // Is sunset approaching before the sunrise?
      let ms = lastBuild.getTime();
      if(sunrise.getTime() - ms > sunset.getTime() - ms)
      {
        this.topBoxSunIcon.set_gicon(this.getGIcon("daytime-sunset-symbolic"));
        this.topBoxSunInfo.text = w.displaySunset(this);
      }
      else
      {
        this.topBoxSunIcon.set_gicon(this.getGIcon("daytime-sunrise-symbolic"));
        this.topBoxSunInfo.text = w.displaySunrise(this);
      }

      let weatherInfoC = "";
      let weatherInfoT = "";

      let condition = w.displayCondition();
      let temp = w.displayTemperature(this);

      if (this._comment_in_panel) weatherInfoC = condition;
      if (this._text_in_panel) weatherInfoT = temp;

      this._weatherInfo.text =
        weatherInfoC +
        (weatherInfoC && weatherInfoT ? _(", ") : "") +
        weatherInfoT;

      this._currentWeatherSummary.text = condition + (", ") + temp;

      let locText;
      if (this._loc_len_current !== 0 &&
        location.length > this._loc_len_current)
      {
        locText = location.substring(0, this._loc_len_current - 3) + "...";
      }
      else
      {
        locText = location;
      }

      let feelsLikeText = w.displayFeelsLike(this);
      let humidityText = w.displayHumidity();
      let pressureText = w.displayPressure(this);
      let windText = w.displayWind(this);

      this._currentWeatherSunrise.text = w.displaySunrise(this);
      this._currentWeatherSunset.text = w.displaySunset(this);
      this._currentWeatherBuild.text = this.formatTime(lastBuild);

      if(this._currentWeatherLocation) this._currentWeatherLocation.text = locText;
      if(this._currentWeatherFeelsLike) this._currentWeatherFeelsLike.text = feelsLikeText;
      if(this._currentWeatherHumidity) this._currentWeatherHumidity.text = humidityText;
      if(this._currentWeatherPressure) this._currentWeatherPressure.text = pressureText;
      if(this._currentWeatherWind) this._currentWeatherWind.text = windText;
      if(this._currentWeatherWindGusts)
      {
        let available = w.gustsAvailable();
        this.setGustsPanelVisibility(available);
        if(available)
        {
          this._currentWeatherWindGusts.text = w.displayGusts(this);
        }
      }

      if(this._forecast.length > this._forecastDays)
      {
        this._forecast.splice(this._forecastDays, this._forecast.length - this._forecastDays);
        this.rebuildFutureWeatherUi(this._forecastDays);
      }

      resolve(0);
    } catch (e) {
      reject(e);
    }
  });
}

function populateTodaysUI() {
  return new Promise((resolve, reject) => {
    try {
      let weather = this.currentWeatherCache;
      if (!weather) return reject("No weather cached.");
      if (!weather.hasForecast()) return reject("No forecast.");

      const now = new Date();

      // Round down to the next whole hour
      const aligned = new Date(now);
      aligned.setMinutes(0, 0, 0);
      if (now.getMinutes() !== 0 || now.getSeconds() !== 0) {
        aligned.setHours(aligned.getHours() + 1);
      }

      let items = [];

      outer:
      for (let day = 0; day < weather.forecastDayCount(); day++) {
        let n = weather.forecastHourCount(day);
        for (let h = 0; h < n; h++) {
          let fc = weather.forecastDayHour(day, h);
          if (!fc) continue;

          if (fc.getStart() >= aligned || items.length > 0) {
            items.push(fc);
            if (items.length >= 4) break outer;
          }
        }
      }

      // Extreme fallback: none of the above applies (theoretically should not happen)
      if (items.length === 0) {
        let n0 = weather.forecastHourCount(0);
        for (let i = 0; i < Math.min(4, n0); i++) {
          let fc = weather.forecastDayHour(0, i);
          if (fc) items.push(fc);
        }
      }

      // Populate the UI
      for (let i = 0; i < 4; i++) {
        let ui = this._todays_forecast[i];
        if (!ui) continue;

        if (i >= items.length) {
          ui.Time.text = "";
          ui.Icon.set_gicon(this.getGIcon("view-refresh-symbolic"));
          ui.Temperature.text = "";
          ui.Summary.text = "";
          continue;
        }

        let h = items[i];
        let w = h.weather();

        ui.Time.text = h.displayTime(this);
        ui.Icon.set_gicon(this.getGIcon(w.getIconName()));
        ui.Temperature.text = w.displayTemperature(this);
        ui.Summary.text = w.displayCondition();

        // ---- Precipitation display ----
        let pop = w.getPrecipitationProbability();
        let precip = w.getPrecipitation();

        let rain = w.getRain?.() ?? 0;
        let showers = w.getShowers?.() ?? 0;
        let snow = w.getSnowfall?.() ?? 0;

        // Hidden by default
        ui.PrecipBox.hide();
        ui.PrecipText.text = "";
        // ui.PrecipIcon.set_gicon(null);

        if ((pop && pop > 0) || (precip && precip > 0)) {
          let symbol;

          if ((rain + showers) > 0 && snow > 0)
            symbol = "☔︎❄";
          else if (snow > 0)
            symbol = "❄";
          else
            symbol = "☔︎";

          let parts = [];
          if (pop !== null) parts.push(`${Math.round(pop)}%`);
          if (precip !== null) parts.push(`${precip.toFixed(1)} mm`);

          ui.PrecipText.text = `${symbol} ${parts.join(" ")}`;
          ui.PrecipBox.show();
        }
      }

      resolve(0);
    } catch (e) {
      reject(e);
    }
  });
}


function populateForecastUI() {
  return new Promise((resolve, reject) => {
    try {
      let weather = this.currentWeatherCache;
      if (!weather) return reject("Open-Meteo: No weather cached.");
      if (!weather.hasForecast()) return reject("Open-Meteo: No forecast.");

      const HOURS_PER_DAY = 24;

      let dayCount = Math.min(this._days_forecast, weather.forecastDayCount());

      for (let i = 0; i < dayCount; i++) {
        let forecastUi = this._forecast[i];
        if (!forecastUi) break;

        let first = weather.forecastDayHour(i, 0);
        if (first) {
          let forecastDate = first.getStart();
          if (i === 0) forecastUi.Day.text = "\n" + _("Today");
          else if (i === 1) forecastUi.Day.text = "\n" + _("Tomorrow");
          else forecastUi.Day.text = "\n" + this.getLocaleDay(forecastDate.getDay());
        }

        let hourCount = Math.min(HOURS_PER_DAY, weather.forecastHourCount(i));
        for (let j = 0; j < hourCount; j++) {
          if (!forecastUi[j]) continue;

          let h = weather.forecastDayHour(i, j);
          if (!h) break;

          let w = h.weather();

          forecastUi[j].Time.text = h.displayTime(this);
          forecastUi[j].Icon.set_gicon(this.getGIcon(w.getIconName()));
          forecastUi[j].Temperature.text = w.displayTemperature(this);
          forecastUi[j].Summary.text = w.displayCondition();

          // ---- Precipitation display (forecast) ----
          let pop = w.getPrecipitationProbability();
          let precip = w.getPrecipitation();

          let rain = w.getRain?.() ?? 0;
          let showers = w.getShowers?.() ?? 0;
          let snow = w.getSnowfall?.() ?? 0;

          // Hidden by default
          forecastUi[j].PrecipBox.hide();
          forecastUi[j].PrecipText.text = "";
          // forecastUi[j].PrecipIcon.set_gicon(null);

          if ((pop && pop > 0) || (precip && precip > 0)) {
            let symbol;

            if ((rain + showers) > 0 && snow > 0)
              symbol = "☔︎❄";
            else if (snow > 0)
              symbol = "❄";
            else
              symbol = "☔︎";

            // forecastUi[j].PrecipIcon.set_gicon(this.getGIcon(icon));
            let parts = [];
            if (pop !== null) parts.push(`${Math.round(pop)}%`);
            if (precip !== null) parts.push(`${precip.toFixed(1)} mm`);

            forecastUi[j].PrecipText.text = `${symbol} ${parts.join(" ")}`;
            forecastUi[j].PrecipBox.show();
          }

        }
      }

      resolve(0);
    } catch (e) {
      reject(e);
    }
  });
}

export {
  initWeatherData,
  reloadWeatherCache,
  refreshWeatherData,
  populateCurrentUI,
  populateTodaysUI,
  populateForecastUI,
};
