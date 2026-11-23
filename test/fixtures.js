// Recorded-shape Abode payloads and an in-memory Abode client, so the tests
// never touch the network.

export function panelFixture(mode = 'standby') {
  return {
    name: 'Home',
    mac: 'B0:C5:CA:00:11:22',
    model: 'L1',
    online: '1',
    mode: { area_1: mode, area_2: 'standby' },
  };
}

export function devicesFixture() {
  return [
    {
      id: 'RF:00000001',
      type_tag: 'device_type.door_contact',
      type: 'Door Contact',
      name: 'Front door',
      status: 'Closed',
      faults: { low_battery: 0, tempered: 0, supervision: 0, out_of_order: 0, no_response: 0 },
    },
    {
      id: 'RF:00000002',
      type_tag: 'device_type.pir',
      type: 'Motion Sensor',
      name: 'Hallway motion',
      status: 'Online',
      faults: { low_battery: 0, tempered: 0, no_response: 0 },
    },
    {
      id: 'ZW:00000003',
      type_tag: 'device_type.door_lock',
      type: 'Door Lock',
      name: 'Back door lock',
      status: 'LockClosed',
      control_url: 'api/v1/control/lock/ZW:00000003',
      faults: { low_battery: 0, jammed: 0 },
    },
    {
      id: 'ZW:00000004',
      type_tag: 'device_type.dimmer_meter',
      type: 'Dimmer',
      name: 'Living room light',
      status: 'On',
      statuses: { level: '60' },
      control_url: 'api/v1/control/light/ZW:00000004',
    },
    {
      id: 'ZW:00000005',
      type_tag: 'device_type.power_switch_sensor',
      type: 'Power Switch',
      name: 'Coffee machine',
      status: 'Off',
      control_url: 'api/v1/control/power_switch/ZW:00000005',
    },
    {
      id: 'ZB:00000006',
      type_tag: 'device_type.lm',
      type: 'Multi-Sensor',
      name: 'Bedroom sensor',
      status: 'Online',
      statuses: { temperature: '21.5 °C', humidity: '48 %', lux: '120 lx' },
      faults: { low_battery: 0 },
    },
    {
      id: 'RF:00000007',
      type_tag: 'device_type.water_sensor',
      type: 'Water Sensor',
      name: 'Laundry leak',
      status: 'Dry',
      faults: { low_battery: 0 },
    },
    {
      id: 'XF:b0c5ca000099',
      uuid: 'cam-uuid-1',
      type_tag: 'device_type.ipcam',
      type: 'Streaming Camera',
      name: 'Garden camera',
      status: 'Online',
    },
    {
      id: 'ZW:00000008',
      type_tag: 'device_type.secure_barrier',
      type: 'Garage door',
      name: 'Garage',
      status: 'Closed',
      control_url: 'api/v1/control/power_switch/ZW:00000008',
    },
    {
      id: 'RF:00000009',
      type_tag: 'device_type.keypad',
      type: 'Keypad',
      name: 'Keypad',
      status: 'Online',
    },
  ];
}

export function timelineFixture() {
  return [
    {
      id: '1002',
      event_utc: '1764000100',
      event_code: '5100',
      event_type: 'Status Change',
      event_name: 'Front door opened',
      device_id: 'RF:00000001',
      device_name: 'Front door',
    },
    {
      id: '1001',
      event_utc: '1764000000',
      event_code: '3401',
      event_type: 'Disarm',
      event_name: 'Disarmed by keypad',
      device_id: 'RF:00000009',
      device_name: 'Keypad',
    },
  ];
}

/** In-memory AbodeClient: same methods, records the calls. */
export class FakeAbodeClient {
  constructor() {
    this.panel = panelFixture();
    this.devices = devicesFixture();
    this.timeline = timelineFixture();
    this.automations = [
      { id: '11', name: 'Good night', enabled: true },
      { id: '12', name: 'Lights off', enabled: true },
    ];
    this.calls = [];
    this.failWith = null;
    this.image = null;
  }

  async check() {
    if (this.failWith) {
      throw this.failWith;
    }
  }

  async getPanel() {
    await this.check();
    return structuredClone(this.panel);
  }

  async getDevices() {
    await this.check();
    return structuredClone(this.devices);
  }

  async getTimeline() {
    await this.check();
    return structuredClone(this.timeline);
  }

  async setMode(mode) {
    this.calls.push(['setMode', mode]);
    this.panel.mode.area_1 = mode;
    return mode;
  }

  async setStatus(device, status) {
    this.calls.push(['setStatus', device.id, status]);
  }

  async setLevel(device, level) {
    this.calls.push(['setLevel', device.id, level]);
  }

  async getAutomations() {
    return structuredClone(this.automations);
  }

  async applyAutomation(id) {
    this.calls.push(['applyAutomation', id]);
  }

  async snapshot(device) {
    this.calls.push(['snapshot', device.id]);
    return this.image;
  }

  async logout() {}
}
