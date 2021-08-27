import { loc, View, createCallout, _ } from 'okta';
import { BaseForm } from '../../internals';
import email from '../shared/email';
import BaseAuthenticatorView from '../../components/BaseAuthenticatorView';
import { SHOW_RESEND_TIMEOUT } from '../../utils/Constants';
import BaseFormWithPolling from '../../internals/BaseFormWithPolling';
import sessionStorageHelper from '../../../client/sessionStorageHelper';

const ResendView = View.extend(
  {
    className: 'hide resend-email-view',
    events: {
      'click a.resend-link' : 'handelResendLink'
    },

    initialize() {
      this.add(createCallout({
        content: `${loc('email.code.not.received', 'login')}
        <a class='resend-link'>${loc('email.button.resend', 'login')}</a>`,
        type: 'warning',
      }));
    },

    handelResendLink() {
      this.options.appState.trigger('invokeAction', this.options.resendEmailAction);
      // Hide warning, but reinitiate to show warning again after some threshold of polling
      if (!this.$el.hasClass('hide')) {
        this.$el.addClass('hide');
      }
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
  },
);

const Body = BaseFormWithPolling.extend(Object.assign(
  {
    save() {
      return loc('mfa.challenge.verify', 'login');
    },
    initialize() {
      BaseFormWithPolling.prototype.initialize.apply(this, arguments);

      this.add(ResendView, {
        selector: '.o-form-error-container',
        options: {
          resendEmailAction: this.resendEmailAction,
        }
      });
      this.startPolling();
    },

    saveForm() {
      BaseForm.prototype.saveForm.apply(this, arguments);
      this.stopPolling();
    },

    remove() {
      BaseForm.prototype.remove.apply(this, arguments);
      this.stopPolling();
    },

    triggerAfterError(model, error) {
      BaseForm.prototype.triggerAfterError.apply(this, arguments);
      const isFormPolling = !!this.polling;
      this.stopPolling();

      if (error.responseJSON?.errorSummaryKeys?.includes('idx.session.expired')) {
        // Do NOT resume polling since session is invalid and polling is already stopped
        return;
      }

      if (this.isRateLimitError(error)) {
        // When polling encounter rate limit error, wait 60 sec for rate limit bucket to reset
        // before polling again & hide error message
        if (isFormPolling) {
          setTimeout(() => {
            model.trigger('clearFormError');
          }, 0);
        }
        this.startPolling(60000);
      } else {
        this.startPolling(this.options.appState.get('dynamicRefreshInterval'));
      }
    },

    isRateLimitError(error) {
      return (error.responseJSON?.errorSummaryKeys?.includes('tooManyRequests') ||
        error.responseJSON?.errorCode === 'E0000047') &&
        !error.responseJSON?.errorIntent;
    },
  },
  email,
));

export default BaseAuthenticatorView.extend({
  Body,
});
