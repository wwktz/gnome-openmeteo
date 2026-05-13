/*
    SPDX-License-Identifier: GPL-3.0-or-later

    Open-Meteo GNOME Extension
    Weather data provided by Open-Meteo
 
    Copyright 2022 Jason Oickle
    Copyright 2026 Weikang Wang
*/

import GLib from "gi://GLib";
import Soup from "gi://Soup";
import { getSoupSession } from "./myloc.js";
import { getIconName, gettextCondition } from "./weathericons.js";

/**
 * @enum {number}
 */
export const WeatherProvider =
{
  DEFAULT: 0,
  OPENMETEO: 1,

  /** Count of usable providers */
  COUNT: 1
};

export function getWeatherProviderName(prov)
{
  return "Open-Meteo";
}

export function getWeatherProviderUrl(prov)
{
  return "https://open-meteo.com/";
}

export function getWeatherProvider(settings)
{
  return WeatherProvider.OPENMETEO;
}

/* ================= Weather / Forecast ================= */

export class Weather
{
  #iconName;
  #condition;

  #tempC;
  #feelsLikeC;
  #humidityPercent;
  #pressureMBar;
  #windMps;
  #windDirDeg;
  #gustsMps;
  #precipProb;
  #precip;
  #rain;
  #showers;
  #snowfall;

  #sunrise;
  #sunset;
  #forecasts;

  constructor(
    tempC,
    feelsLikeC,
    humidityPercent,
    pressureMBar,
    windMps,
    windDirDeg,
    gustsMps,
    iconName,
    condition,
    sunrise,
    sunset,
    forecasts = null,
    precipProb = null,
    precip = null,
    rain = null,
    showers = null,
    snowfall = null
  )
  {
    this.#tempC = tempC;
    this.#feelsLikeC = feelsLikeC;
    this.#humidityPercent = humidityPercent;
    this.#pressureMBar = pressureMBar;
    this.#windMps = windMps;
    this.#windDirDeg = windDirDeg;
    this.#gustsMps = gustsMps;
    this.#iconName = iconName;
    this.#sunrise = sunrise;
    this.#sunset = sunset;
    this.#forecasts = forecasts && forecasts.length > 0 ? forecasts : null;
    this.#precipProb = precipProb;
    this.#precip = precip;
    this.#rain = rain;
    this.#showers = showers;
    this.#snowfall = snowfall;

    if (typeof condition === "string")
      this.#condition = condition;
    else
      throw new Error(`Weather condition not string`);
  }

  getIconName() { return this.#iconName; }
  displayCondition() { return this.#condition; }
  displayTemperature(ext) { return ext.formatTemperature(this.#tempC); }
  displayFeelsLike(ext) { return ext.formatTemperature(this.#feelsLikeC); }
  displayHumidity() { return `${this.#humidityPercent}%`; }
  displayPressure(ext) { return ext.formatPressure(this.#pressureMBar); }
  displayWind(ext)
  {
    let dir = ext.getWindDirection(this.#windDirDeg);
    return ext.formatWind(this.#windMps, dir);
  }
  displayGusts(ext) { return ext.formatWind(this.#gustsMps); }
  gustsAvailable() { return typeof this.#gustsMps === "number"; }
  displaySunrise(ext) { return ext.formatTime(this.#sunrise); }
  displaySunset(ext) { return ext.formatTime(this.#sunset); }
  getSunriseDate() { return this.#sunrise; }
  getSunsetDate() { return this.#sunset; }
  
  getPrecipitationProbability() { return this.#precipProb; }
  getPrecipitation() { return this.#precip; }
  getRain() { return this.#rain; }
  getShowers() { return this.#showers; }
  getSnowfall() { return this.#snowfall; }

  hasForecast() { return this.#forecasts !== null; }
  forecastDayCount() { return this.#forecasts.length; }
  forecastHourCount(i) { return this.#forecasts[i].length; }
  forecastDayHour(i, j) { return this.#forecasts[i][j]; }
}

export class Forecast
{
  #start;
  #end;
  #weather;

  constructor(start, end, weather)
  {
    this.#start = start;
    this.#end = end;
    this.#weather = weather;
  }

  getStart() { return this.#start; }
  getEnd() { return this.#end; }
  displayTime(ext) { return ext.formatTime(this.#start); }
  weather() { return this.#weather; }
}

/* ================= HTTP ================= */

async function loadJsonAsync(url, params)
{
  return new Promise((resolve, reject) =>
  {
    let session = getSoupSession();
    let query = Soup.form_encode_hash(params);
    let msg = Soup.Message.new_from_encoded_form("GET", url, query);

    session.send_and_read_async(msg, GLib.PRIORITY_DEFAULT, null,
      (s, res) =>
      {
        try
        {
          let bytes = s.send_and_read_finish(res);
          let text = bytes.get_data();
          if (text instanceof Uint8Array)
            text = new TextDecoder().decode(text);
          resolve([msg.status_code, JSON.parse(text)]);
        }
        catch (e)
        {
          reject(e);
        }
      }
    );
  });
}

function isSuccess(code)
{
  return code >= 200 && code < 300;
}

function clamp(lo, x, hi)
{
  return Math.min(Math.max(lo, x), hi);
}

function getCondit(extension, code, _cond, gettext)
{
  if (!extension._translate_condition || !gettext)
    return "";
  return gettextCondition(getWeatherProvider(extension.settings), code, gettext);
}

/* ================= Open-Meteo ================= */

export async function getWeatherInfo(extension, gettext)
{
  
  function isNightTime(time, sunrise, sunset)
  {
    return time < sunrise || time >= sunset;
  }
  const settings = extension.settings;
  let [lat, lon] = await extension._city.getCoords(settings);

  let response = await loadJsonAsync(
    "https://api.open-meteo.com/v1/forecast",
    {
      latitude: String(lat),
      longitude: String(lon),
      timezone: "auto",
      temperature_unit: "celsius",
      wind_speed_unit: "ms",

      current:
        "temperature_2m,apparent_temperature,relative_humidity_2m," +
        "surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weathercode",

      hourly:
        "temperature_2m,apparent_temperature,relative_humidity_2m," +
        "surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weathercode," + 
        "precipitation_probability,precipitation,rain,showers,snowfall",

      daily: "sunrise,sunset"
    }
  );

  if (!isSuccess(response[0])){
    return null;
  }

  let json = response[1];
  let m = json.current;

  let sunrise = new Date(json.daily.sunrise[0]);
  let sunset  = new Date(json.daily.sunset[0]);

  let forecastDays = clamp(1, extension._days_forecast + 1, 8);
  extension._forecastDays = forecastDays - 1;

  let forecasts = [];
  let hourly = json.hourly;

  for (let i = 0; i < forecastDays; i++)
  {
    let day = [];
    for (let j = 0; j < 24; j++)
    {
      let idx = i * 24 + j;
      if (!hourly.time[idx]) break;

      let start = new Date(hourly.time[idx]);
      let end = new Date(start.getTime() + 3600000);
      const night = isNightTime(start, sunrise, sunset);
      day.push(new Forecast(
        start,
        end,
        new Weather(
          hourly.temperature_2m[idx],
          hourly.apparent_temperature[idx],
          hourly.relative_humidity_2m[idx],
          hourly.surface_pressure[idx],
          hourly.wind_speed_10m[idx],
          hourly.wind_direction_10m[idx],
          hourly.wind_gusts_10m[idx],
          getIconName(WeatherProvider.OPENMETEO, hourly.weathercode[idx], night, true),
          getCondit(extension, hourly.weathercode[idx], "", gettext),
          sunrise,
          sunset,
          null,
          hourly.precipitation_probability?.[idx] ?? null,
          hourly.precipitation?.[idx] ?? null,
          hourly.rain?.[idx] ?? null,
          hourly.showers?.[idx] ?? null,
          hourly.snowfall?.[idx] ?? null
        )
      ));
    }
    forecasts.push(day);
  }

  const now = new Date();
  const night = isNightTime(now, sunrise, sunset);
  return new Weather(
    m.temperature_2m,
    m.apparent_temperature,
    m.relative_humidity_2m,
    m.surface_pressure,
    m.wind_speed_10m,
    m.wind_direction_10m,
    m.wind_gusts_10m,
    getIconName(WeatherProvider.OPENMETEO, m.weathercode, night, true),
    getCondit(extension, m.weathercode, "", gettext),
    sunrise,
    sunset,
    forecasts,
    null,
    null,
    null,
    null,
    null,
    null
  );
}
