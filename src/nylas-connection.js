import _ from 'underscore';
import clone from 'clone';
import request from 'request';
import Promise from 'bluebird';

import RestfulModel from './models/restful-model';
import RestfulModelCollection from './models/restful-model-collection';
import RestfulModelInstance from './models/restful-model-instance';
import Account from './models/account';
import ManagementAccount from './models/management-account';
import ManagementModelCollection from './models/management-model-collection';
import Thread from './models/thread';
import Contact from './models/contact';
import Message from './models/message';
import Draft from './models/draft';
import File from './models/file';
import Calendar from './models/calendar';
import Event from './models/event';
import Delta from './models/delta';
import { Label, Folder } from './models/folder';

const PACKAGE_JSON = require('../package.json');
const SDK_VERSION = PACKAGE_JSON.version;
const SUPPORTED_API_VERSION = '1.0';

module.exports = class NylasConnection {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.threads = new RestfulModelCollection(Thread, this);
    this.contacts = new RestfulModelCollection(Contact, this);
    this.messages = new RestfulModelCollection(Message, this);
    this.drafts = new RestfulModelCollection(Draft, this);
    this.files = new RestfulModelCollection(File, this);
    this.calendars = new RestfulModelCollection(Calendar, this);
    this.events = new RestfulModelCollection(Event, this);
    this.deltas = new Delta(this);
    this.labels = new RestfulModelCollection(Label, this);
    this.folders = new RestfulModelCollection(Folder, this);
    this.account = new RestfulModelInstance(Account, this);
  }

  requestOptions(options) {
    if (!options) {
      options = {};
    }
    options = clone(options);
    const Nylas = require('./nylas');
    if (!options.method) {
      options.method = 'GET';
    }
    if (options.path) {
      if (!options.url) {
        options.url = `${Nylas.apiServer}${options.path}`;
      }
    }
    if (!options.formData) {
      if (!options.body) {
        options.body = {};
      }
    }
    if (options.json == null) {
      options.json = true;
    }
    if (!options.downloadRequest) {
      options.downloadRequest = false;
    }

    // For convenience, If `expanded` param is provided, convert to view:
    // 'expanded' api option
    if (options.qs && options.qs.expanded) {
      if (options.qs.expanded === true) {
        options.qs.view = 'expanded';
      }
      delete options.qs.expanded;
    }

    const user =
      options.path.substr(0, 3) === '/a/' ? Nylas.appSecret : this.accessToken;

    if (user) {
      options.auth = {
        user: user,
        pass: '',
        sendImmediately: true,
      };
    }

    if (options.headers == null) {
      options.headers = {};
    }
    if (options.headers['User-Agent'] == null) {
      options.headers['User-Agent'] = `Nylas Node SDK v${SDK_VERSION}`;
    }

    options.headers['Nylas-SDK-API-Version'] = SUPPORTED_API_VERSION;

    return options;
  }

  request(options) {
    if (!options) {
      options = {};
    }
    options = this.requestOptions(options);

    return new Promise((resolve, reject) => {
      return request(options, (error, response, body = {}) => {
        const apiVersion = response.headers['nylas-api-version'];
        if (SUPPORTED_API_VERSION != apiVersion) {
          console.warn(
            `WARNING: ${SDK_VERSION} may not support Nylas API v${apiVersion}.`
          );
          console.warn('Upgrade package to ensure that it works properly.');
        }

        if (error || response.statusCode > 299) {
          if (!error) {
            error = new Error(body.message);
          }
          if (body.server_error) {
            error = `${error.message} (Server Error: ${body.server_error})`;
          }
          return reject(error);
        } else {
          if (options.downloadRequest) {
            return resolve(response);
          } else if (options.json === false) {
            return resolve(JSON.parse(body));
          } else {
            return resolve(body);
          }
        }
      });
    });
  }
};
