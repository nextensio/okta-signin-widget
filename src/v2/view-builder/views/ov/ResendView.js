import { View, createCallout, _ } from 'okta';
import hbs from 'handlebars-inline-precompile';
import { SHOW_RESEND_TIMEOUT } from '../../utils/Constants';
import sessionStorageHelper from '../../../client/sessionStorageHelper';

export default View.extend({
  //only show after certain threshold of polling
  className: 'hide resend-ov-link-view',
  events: {
    'click a.resend-link' : 'handelResendLink'
  },

  initialize() {
    const selectedChannel = this.options.appState.get('currentAuthenticator').contextualData.selectedChannel;
    this.add(createCallout({
      content: selectedChannel === 'email' ?
        hbs `{{{i18n code="oie.enroll.okta_verify.email.notReceived" bundle="login"}}}`:
        hbs `{{{i18n code="oie.enroll.okta_verify.sms.notReceived" bundle="login"}}}`,
      type: 'warning',
    }));
  },

  handelResendLink() {
    this.options.appState.trigger('invokeAction', 'currentAuthenticator-resend');
    //hide warning, but reinitiate to show warning again after some threshold of polling
    this.$el.addClass('hide');
    this.showCalloutWithDelay();
  },

  postRender() {
    this.showCalloutWithDelay();
  },

  showCalloutWithDelay() {
    const timeStamp = sessionStorageHelper.getResendTimestamp();
    if (!timeStamp) {
      sessionStorageHelper.setResendTimestamp(Date.now());
    }

    // We keep track of a 'global' timestamp in sessionStorage because if the SIW does a re-render,
    // we don't want to force the user to wait another 30s again to see the resend link. With this
    // the user will wait AT MOST 30s until they see the resend link.
    const start = sessionStorageHelper.getResendTimestamp();
    this.showMeTimeout = setInterval(() => {
      const now = Date.now();
      if (now - start >= SHOW_RESEND_TIMEOUT) {
        this.$el.removeClass('hide');
        clearInterval(this.showMeTimeout);
        sessionStorageHelper.removeResendTimestamp();
      }      
    }, 250);
  },

  remove() {
    View.prototype.remove.apply(this, arguments);
    clearTimeout(this.showMeTimeout);
  }
});
