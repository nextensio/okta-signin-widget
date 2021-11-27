import { RequestMock, RequestLogger } from 'testcafe';

import ConsentPageObject from '../framework/page-objects/ConsentPageObject';
import SuccessPageObject from '../framework/page-objects/SuccessPageObject';

import xhrConsentEnduser from '../../../playground/mocks/data/idp/idx/consent-enduser';
import xhrSuccess from '../../../playground/mocks/data/idp/idx/success';
import xhrConsentEnduserCustomScopes from '../../../playground/mocks/data/idp/idx/consent-enduser-custom-scopes';
import terminalResetPasswordNotAllowed from '../../../playground/mocks/data/idp/idx/error-reset-password-not-allowed';
import TerminalPageObject from '../framework/page-objects/TerminalPageObject';

const consentEnduserMock = RequestMock()
  .onRequestTo('http://localhost:3000/idp/idx/introspect')
  .respond(xhrConsentEnduser)
  .onRequestTo('http://localhost:3000/idp/idx/consent')
  .respond(xhrSuccess);

const consentEnduserCustomScopesMock = RequestMock()
  .onRequestTo('http://localhost:3000/idp/idx/introspect')
  .respond(xhrConsentEnduserCustomScopes)
  .onRequestTo('http://localhost:3000/idp/idx/consent')
  .respond(xhrSuccess);

const consentEnduserFailedMock = RequestMock()
  .onRequestTo('http://localhost:3000/idp/idx/introspect')
  .respond(xhrConsentEnduser)
  .onRequestTo('http://localhost:3000/idp/idx/consent')
  .respond(terminalResetPasswordNotAllowed);

const requestLogger = RequestLogger(/consent/,
  {
    logRequestBody: true,
    stringifyRequestBody: true,
  }
);

async function setup(t) {
  const consentPage = new ConsentPageObject(t);
  await consentPage.navigateToPage();
  return consentPage;
}

async function testRedirect(t) {
  const successPage = new SuccessPageObject(t);
  const pageUrl = await successPage.getPageUrl();
  return t.expect(pageUrl)
    .eql('http://localhost:3000/app/UserHome?stateToken=mockedStateToken123');
}

fixture('EnduserConsent');

test.requestHooks(requestLogger, consentEnduserMock)('should render scopes', async t => {
  const consentPage  = await setup(t);

  await t.expect(consentPage.getScopeItemTexts()).eql([
    'View your email address.',
    'View your phone number.',
  ]);
});

test.requestHooks(requestLogger, consentEnduserCustomScopesMock)('should render custom scopes', async t => {
  const consentPage  = await setup(t);

  await t.expect(consentPage.getScopeItemTexts()).eql([
    'View your mobile phone data plan.',
    'View your internet search history.',
  ]);
});

test.requestHooks(requestLogger, consentEnduserCustomScopesMock)('should display correct titleText', async t => {
  const consentPage  = await setup(t);

  await t.expect(await consentPage.getHeaderTitleText()).eql('would like to:');
});

test.requestHooks(requestLogger, consentEnduserMock)('should call /consent and send {consent: true} on "Allow Access" click', async t => {
  const consentPage  = await setup(t);

  await consentPage.clickAllowButton();
  const { request: {body, method, url}} = requestLogger.requests[requestLogger.requests.length - 1];
  const jsonBody = JSON.parse(body);

  await t.expect(jsonBody.consent).eql(true);
  await t.expect(method).eql('post');
  await t.expect(url).eql('http://localhost:3000/idp/idx/consent');

  await testRedirect(t);
});

test.requestHooks(requestLogger, consentEnduserMock)('should call /consent and send {consent: false} on "Don\'t Allow" click', async t => {
  const consentPage  = await setup(t);

  await consentPage.clickDontAllowButton();
  const { request: {body, method, url}} = requestLogger.requests[requestLogger.requests.length - 1];
  const jsonBody = JSON.parse(body);

  await t.expect(jsonBody.consent).eql(false);
  await t.expect(method).eql('post');
  await t.expect(url).eql('http://localhost:3000/idp/idx/consent');

  await testRedirect(t);
});

test.requestHooks(requestLogger, consentEnduserFailedMock)('should go to Terminal View after giving consent and failed', async t => {
  const consentPage  = await setup(t);

  await consentPage.clickDontAllowButton();
  const { request: {body, method, url}} = requestLogger.requests[requestLogger.requests.length - 1];
  const jsonBody = JSON.parse(body);

  await t.expect(jsonBody.consent).eql(false);
  await t.expect(method).eql('post');
  await t.expect(url).eql('http://localhost:3000/idp/idx/consent');

  const terminalPageObject = new TerminalPageObject(t);
  await t.expect(await terminalPageObject.goBackLinkExists()).notOk();
  await t.expect(await terminalPageObject.signoutLinkExists()).ok();
  await t.expect(terminalPageObject.getErrorMessages().isError()).eql(true);
  await t.expect(terminalPageObject.getErrorMessages().getTextContent()).contains('Reset password is not allowed at this time. Please contact support for assistance.');
});
