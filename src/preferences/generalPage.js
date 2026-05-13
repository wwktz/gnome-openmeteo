/*
    SPDX-License-Identifier: GPL-3.0-or-later

    Open-Meteo GNOME Extension
    Weather data provided by Open-Meteo

    Copyright 2022 Jason Oickle
    Copyright 2026 Weikang Wang
*/

import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import GObject from "gi://GObject";

import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

class GeneralPage extends Adw.PreferencesPage
{
  static {
    GObject.registerClass(this);
  }

  constructor(metadata, settings, wnd)
  {
    super({
      title: _("Settings"),
      icon_name: "preferences-system-symbolic",
      name: "GeneralPage",
    });
    this._settings = settings;
    this._window = wnd;

    // General Settings
    let generalGroup = new Adw.PreferencesGroup({
      title: _("General"),
    });

    // Current weather refresh
    let currentRefreshSpinButton = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: 10,
        upper: 1440,
        step_increment: 1,
        page_increment: 10,
        value: this._settings.get_int("refresh-interval-current") / 60,
      }),
      climb_rate: 5,
      numeric: true,
      update_policy: "if-valid",
      valign: Gtk.Align.CENTER,
    });
    let currentRefreshRow = new Adw.ActionRow({
      title: _("Current Weather Refresh"),
      subtitle: _("Current weather refresh interval in minutes"),
      activatable_widget: currentRefreshSpinButton,
    });
    currentRefreshRow.add_suffix(currentRefreshSpinButton);

    // forecast refresh
    let disableForecast = this._settings.get_boolean("disable-forecast");
    let forecastRefreshSpinButton = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: 30,
        upper: 1440,
        step_increment: 1,
        page_increment: 10,
        value: this._settings.get_int("refresh-interval-forecast") / 60,
      }),
      climb_rate: 5,
      numeric: true,
      update_policy: "if-valid",
      sensitive: disableForecast ? false : true,
      valign: Gtk.Align.CENTER,
    });
    let forecastRefreshRow = new Adw.ActionRow({
      title: _("Weather Forecast Refresh"),
      subtitle: _("Forecast refresh interval in minutes if enabled"),
      activatable_widget: forecastRefreshSpinButton,
    });
    forecastRefreshRow.add_suffix(forecastRefreshSpinButton);

    // My Location Refresh
    let myLocRefreshSpinButton = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: 10,
        upper: 1440,
        step_increment: 1,
        page_increment: 10,
        value: this._settings.get_double("loc-refresh-interval")
      }),
      climb_rate: 5,
      numeric: true,
      update_policy: "if-valid",
      valign: Gtk.Align.CENTER
    });
    let myLocRefreshRow = new Adw.ActionRow({
      title: _("My Location Refresh"),
      subtitle: _("My location refresh interval in minutes"),
      activatable_widget: myLocRefreshSpinButton
    });
    myLocRefreshRow.add_suffix(myLocRefreshSpinButton);
    
    // disable forecast
    let disableForecastSwitch = new Gtk.Switch({
      valign: Gtk.Align.CENTER,
      active: disableForecast,
    });
    let disableForecastRow = new Adw.ActionRow({
      title: _("Disable Forecast"),
      subtitle: _("Disables all fetching and processing of forecast data"),
      activatable_widget: disableForecastSwitch,
    });
    disableForecastRow.add_suffix(disableForecastSwitch);

    // Icons
    let systemIconsSwitch = new Gtk.Switch({
      valign: Gtk.Align.CENTER,
      active: this._settings.get_boolean("use-system-icons"),
    });
    let systemIconsRow = new Adw.ActionRow({
      title: _("System Icons"),
      subtitle: _("Disable to use packaged %s weather icons").format("Breeze"),
      tooltip_text: _(
        "If you have issues with your system icons displaying correctly disable this to fix it"
      ),
      activatable_widget: systemIconsSwitch,
    });
    systemIconsRow.add_suffix(systemIconsSwitch);

    // Startup delay
    let startupDelaySpinButton = new Gtk.SpinButton({
      adjustment: new Gtk.Adjustment({
        lower: 0,
        upper: 30,
        step_increment: 1,
        page_increment: 10,
        value: this._settings.get_int("delay-ext-init"),
      }),
      climb_rate: 1,
      numeric: true,
      update_policy: "if-valid",
      valign: Gtk.Align.CENTER,
    });
    let startupDelayRow = new Adw.ActionRow({
      title: _("First Boot Delay"),
      subtitle: _("Seconds to delay popup initialization and data fetching"),
      tooltip_text: _(
        "This setting only applies to the first time the extension is loaded. (first log in / restarting gnome shell)"
      ),
      activatable_widget: startupDelaySpinButton,
    });
    startupDelayRow.add_suffix(startupDelaySpinButton);

    generalGroup.add(currentRefreshRow);
    generalGroup.add(forecastRefreshRow);
    generalGroup.add(myLocRefreshRow);
    generalGroup.add(disableForecastRow);
    generalGroup.add(systemIconsRow);
    generalGroup.add(startupDelayRow);
    this.add(generalGroup);

    // Units Group
    let unitsGroup = new Adw.PreferencesGroup({
      title: _("Units"),
    });

    // Temperature
    let temperatureUnits = new Gtk.StringList();
    temperatureUnits.append(_("\u00B0C"));
    temperatureUnits.append(_("\u00B0F"));
    temperatureUnits.append(_("K")); 
    let selTempUnit = this._settings.get_enum("unit");
    let unitIsDegs = selTempUnit !== 2;
    let temperatureUnitRow = new Adw.ComboRow({
      title: _("Temperature"),
      model: temperatureUnits,
      selected: this._settings.get_enum("unit"),
    });

    // Wind speed
    let windSpeedUnits = new Gtk.StringList();
    windSpeedUnits.append(_("km/h"));
    windSpeedUnits.append(_("mph"));
    windSpeedUnits.append(_("m/s"));
    windSpeedUnits.append(_("kn"));
    windSpeedUnits.append(_("Beaufort"));
    let windSpeedUnitRow = new Adw.ComboRow({
      title: _("Wind Speed"),
      model: windSpeedUnits,
      selected: this._settings.get_enum("wind-speed-unit"),
    });

    // Pressure
    let pressureUnits = new Gtk.StringList();
    pressureUnits.append(_("mbar"));
    pressureUnits.append(_("inHg"));
    pressureUnits.append(_("bar"));
    pressureUnits.append(_("Pa"));
    pressureUnits.append(_("kPa"));
    pressureUnits.append(_("atm"));
    pressureUnits.append(_("mmHg"));
    let pressureUnitRow = new Adw.ComboRow({
      title: _("Pressure"),
      model: pressureUnits,
      selected: this._settings.get_enum("pressure-unit"),
    });

    // Clock Format
    let clockFormat = new Gtk.StringList();
    clockFormat.append(_("24-hour"));
    clockFormat.append(_("AM / PM"));
    clockFormat.append(_("System"));
    let clockFormatRow = new Adw.ComboRow({
      title: _("Time Format"),
      model: clockFormat,
      selected: this._settings.get_enum("clock-format")
    });

    let simplifyDegSwitch = new Gtk.Switch({
      valign: Gtk.Align.CENTER,
      active: this._settings.get_boolean("simplify-degrees")
    });
    simplifyDegSwitch.set_sensitive(unitIsDegs);
    let simplifyDegRow = new Adw.ActionRow({
      title: _("Simplify Degrees"),
      subtitle: _('Show "\u00B0" instead of "\u00B0C," "\u00B0F," etc.'),
      tooltip_text: _("Enable this to cut off the \"C,\" \"F,\" etc. from degrees labels."),
      activatable_widget: simplifyDegSwitch
    });
    simplifyDegRow.add_suffix(simplifyDegSwitch);

    unitsGroup.add(temperatureUnitRow);
    unitsGroup.add(windSpeedUnitRow);
    unitsGroup.add(pressureUnitRow);
    unitsGroup.add(clockFormatRow);
    unitsGroup.add(simplifyDegRow);
    this.add(unitsGroup);

    let resetGroup = new Adw.PreferencesGroup({
      title: _("Reset")
    });

    let resetToDefsBtn = new Gtk.Button({
      child: new Adw.ButtonContent({
        icon_name: "view-refresh-symbolic",
        label: _("Reset"),
      }),
    });
    let resetToDefsRow = new Adw.ActionRow({
      title: _("Restore Defaults"),
      tooltip_text: _(
        "Restore all settings to the defaults."
      ),
      activatable_widget: resetToDefsBtn,
    });
    resetToDefsRow.add_suffix(resetToDefsBtn);

    resetGroup.add(resetToDefsRow);
    this.add(resetGroup);

    // Bind signals
    currentRefreshSpinButton.connect("value-changed", (widget) => {
      this._settings.set_int(
        "refresh-interval-current",
        60 * widget.get_value()
      );
    });
    forecastRefreshSpinButton.connect("value-changed", (widget) => {
      this._settings.set_int(
        "refresh-interval-forecast",
        60 * widget.get_value()
      );
    });
    myLocRefreshSpinButton.connect("value-changed", (widget) => {
      this._settings.set_double("loc-refresh-interval", widget.get_value());
    });
    disableForecastSwitch.connect("notify::active", (widget) => {
      if (widget.get_active()) {
        forecastRefreshSpinButton.set_sensitive(false);
      } else {
        forecastRefreshSpinButton.set_sensitive(true);
      }
      this._settings.set_boolean("disable-forecast", widget.get_active());
    });
    systemIconsSwitch.connect("notify::active", (widget) => {
      this._settings.set_boolean("use-system-icons", widget.get_active());
    });
    startupDelaySpinButton.connect("value-changed", (widget) => {
      this._settings.set_int("delay-ext-init", widget.get_value());
    });
    temperatureUnitRow.connect("notify::selected", (widget) => {
      let unit = widget.selected;
      simplifyDegSwitch.set_sensitive(unit !== 2);
      this._settings.set_enum("unit", unit);
    });
    windSpeedUnitRow.connect("notify::selected", (widget) => {
      this._settings.set_enum("wind-speed-unit", widget.selected);
    });
    pressureUnitRow.connect("notify::selected", (widget) => {
      this._settings.set_enum("pressure-unit", widget.selected);
    });
    clockFormatRow.connect("notify::selected", (widget) => {
      this._settings.set_enum("clock-format", widget.selected);
    });
    simplifyDegSwitch.connect("notify::active", (widget) => {
      this._settings.set_boolean("simplify-degrees", widget.get_active());
    });
    resetToDefsBtn.connect("clicked", () =>
      {
        let keys = this._settings.list_keys();
        this._settings.set_boolean("frozen", true);

        for(let k of keys)
        {
          this._settings.reset(k);
        }

        this._settings.reset("frozen");
      }
    );
  }
}
export { GeneralPage };
