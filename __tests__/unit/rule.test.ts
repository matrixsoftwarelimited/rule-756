// SPDX-License-Identifier: Apache-2.0

import { handleTransaction } from '../../src';
import { type DatabaseManagerInstance, LoggerService, CreateDatabaseManager } from '@frmscoe/frms-coe-lib';
import { type Band, type DataCache, Rule, type RuleConfig, type RuleRequest, type RuleResult } from '@frmscoe/frms-coe-lib/lib/interfaces';

jest.mock('@frmscoe/frms-coe-lib', () => {
  const original = jest.requireActual('@frmscoe/frms-coe-lib');
  return {
    ...original,
    aql: jest.fn(),
  };
});

const getMockRequest = (amount: number): RuleRequest => {
  const mockRule = (id: string, cfg: string, host: string): Rule => ({
    id,
    cfg,
    host,
    typologies: [],
    getStrValue: () => `${id}:${cfg}:${host}`, // Mocked implementation
  });

  const quote: RuleRequest = {
    transaction: {
      TxTp: 'pacs.002.001.12',
      FIToFIPmtSts: {
        GrpHdr: {
          MsgId: '6b444365119746c5be7dfb5516ba67c4',
          CreDtTm: new Date('Mon Dec 03 2021 09:24:48 GMT+0000').toISOString(),
        },
        TxInfAndSts: {
          OrgnlInstrId: '5ab4fc7355de4ef8a75b78b00a681ed2',
          OrgnlEndToEndId: '2c516801007642dfb892944dde1cf845',
          TxSts: 'ACCC',
          ChrgsInf: [
            {
              Amt: { Amt: amount, Ccy: 'USD' },
              Agt: { FinInstnId: { ClrSysMmbId: { MmbId: 'dfsp001' } } },
            },
            {
              Amt: { Amt: 153.57, Ccy: 'USD' },
              Agt: { FinInstnId: { ClrSysMmbId: { MmbId: 'dfsp001' } } },
            },
            {
              Amt: { Amt: 30.71, Ccy: 'USD' },
              Agt: { FinInstnId: { ClrSysMmbId: { MmbId: 'dfsp002' } } },
            },
          ],
          AccptncDtTm: new Date('2021-12-03T15:36:16.000Z'),
          InstgAgt: { FinInstnId: { ClrSysMmbId: { MmbId: 'dfsp001' } } },
          InstdAgt: { FinInstnId: { ClrSysMmbId: { MmbId: 'dfsp002' } } },
        },
      },
    },
    networkMap: {
      active: true,
      cfg: '1.0.0',
      messages: [
        {
          id: '004@1.0.0',
          host: 'test-host',
          cfg: '1.0.0',
          txTp: 'pacs.002.001.12',
          typologies: [
            {
              id: '901@1.0.0',
              host: 'test-host',
              cfg: '028@1.0',
              desc: 'Typology description',
              rules: [mockRule('004@1.0.0', '1.0.0', 'test-host'), mockRule('028@1.0', '1.0.0', 'test-host')],
            },
            {
              id: '029@1.0',
              host: 'test-host',
              cfg: '029@1.0',
              desc: 'Another typology description',
              rules: [mockRule('003@1.0', '1.0', 'test-host'), mockRule('005@1.0', '1.0', 'test-host')],
            },
          ],
        },
      ],
    },
    DataCache: {
      dbtrId: 'dbtr_516c7065d75b4fcea6fffb52a9539357',
      cdtrId: 'cdtr_b086a1e193794192b32c8af8550d721d',
      dbtrAcctId: 'dbtrAcct_1fd08e408c184dd28cbaeef03bff1af5',
      cdtrAcctId: 'cdtrAcct_d531e1ba4ed84a248fe26617e79fcb64',
      evtId: 'eventId',
      amt: { amt: 1234.56, ccy: 'XTS' },
      creDtTm: new Date().toISOString(),
    },
    metaData: {
      prcgTmDp: Date.now(),
      prcgTmED: Date.now(),
    },
  };
  return quote;
};

const databaseManagerConfig = {
  pseudonyms: {
    certPath: '',
    databaseName: '',
    user: '',
    password: '',
    url: '',
  },
};

let databaseManager: DatabaseManagerInstance<typeof databaseManagerConfig>;
let ruleRes: RuleResult;
const loggerService: LoggerService = new LoggerService();

const ruleConfig: RuleConfig = {
  id: '901@1.0.0',
  cfg: '1.0.0',
  desc: 'Number of outgoing transactions - debtor',
  config: {
    parameters: {
      maxQueryRange: 86400000,
    },
    exitConditions: [
      {
        subRuleRef: '.x00',
        reason: 'Incoming transaction is unsuccessful',
      },
      {
        subRuleRef: '.x01',
        reason: 'Transaction amount exceeds 200',
      },
    ],
    bands: [
      {
        subRuleRef: '.01',
        upperLimit: 2,
        reason: 'The debtor has performed one transaction to date',
      },
      {
        subRuleRef: '.02',
        lowerLimit: 2,
        upperLimit: 4,
        reason: 'The debtor has performed two or three transactions to date',
      },
      {
        subRuleRef: '.03',
        lowerLimit: 4,
        reason: 'The debtor has performed 4 or more transactions to date',
      },
    ],
  },
};

beforeAll(async () => {
  databaseManager = await CreateDatabaseManager(databaseManagerConfig);
  ruleRes = {
    id: '901@1.0.0',
    cfg: '1.0.0',
    subRuleRef: '.00',
    reason: '',
  };
});

afterAll(() => {
  databaseManager.quit();
});

const determineOutcome = (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult): RuleResult => {
  if (value != null) {
    if (ruleConfig.config.bands)
      for (const band of ruleConfig.config.bands) {
        if ((!band.lowerLimit || value >= band.lowerLimit) && (!band.upperLimit || value < band.upperLimit)) {
          ruleResult.subRuleRef = band.subRuleRef;
          ruleResult.reason = band.reason;
          break;
        }
      }
  } else throw new Error('Value provided undefined, so cannot determine rule outcome');
  return ruleResult;
};

describe('Transaction amount check', () => {
  test('Should respond with .x01: Transaction amount exceeds 200', async () => {
    const req = getMockRequest(250); // Amount is greater than 200

    const res = await handleTransaction(req, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);

    expect(res).toEqual(JSON.parse('{"id":"901@1.0.0", "cfg":"1.0.0","subRuleRef":".x01","reason":"Transaction amount exceeds 200"}'));
  });

  test('Should proceed with further checks if amount is 200 or less', async () => {
    const req = getMockRequest(150); // Amount is less than or equal to 200
    const mockQueryFn = jest.fn();
    const mockBatchesAllFn = jest.fn().mockResolvedValue([[1]]);
    databaseManager._pseudonymsDb.query = mockQueryFn.mockResolvedValue({
      batches: {
        all: mockBatchesAllFn,
      },
    });

    const res = await handleTransaction(req, determineOutcome, ruleRes, loggerService, ruleConfig, databaseManager);

    expect(res).toEqual(
      JSON.parse('{"id":"901@1.0.0", "cfg":"1.0.0","subRuleRef":".01","reason":"The debtor has performed one transaction to date"}'),
    );
  });
});
