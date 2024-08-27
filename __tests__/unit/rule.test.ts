// SPDX-License-Identifier: Apache-2.0

import { handleTransaction } from '../../src'; // Rule-902'nin doğru yolu
import { LoggerService } from '@frmscoe/frms-coe-lib';
import { NetworkMap, Pacs002, type RuleConfig, type RuleRequest, type RuleResult } from '@frmscoe/frms-coe-lib/lib/interfaces';

const loggerService: LoggerService = new LoggerService();

const getMockRequest = (amount: number): RuleRequest => {
  const transaction: Pacs002 = {
    TxTp: 'pacs.002.001.12',
    FIToFIPmtSts: {
      GrpHdr: {
        MsgId: 'test-message-id',
        CreDtTm: new Date().toISOString(),
      },
      TxInfAndSts: {
        OrgnlInstrId: 'test-instr-id',
        OrgnlEndToEndId: 'test-end-to-end-id',
        TxSts: 'ACCC',
        ChrgsInf: [
          {
            Amt: {
              Amt: amount,
              Ccy: 'USD',
            },
            Agt: {
              FinInstnId: {
                ClrSysMmbId: {
                  MmbId: 'test-mmb-id',
                },
              },
            },
          },
        ],
        AccptncDtTm: new Date(),
        InstgAgt: {
          FinInstnId: {
            ClrSysMmbId: {
              MmbId: 'instg-mmb-id',
            },
          },
        },
        InstdAgt: {
          FinInstnId: {
            ClrSysMmbId: {
              MmbId: 'instd-mmb-id',
            },
          },
        },
      },
    },
    _key: 'test-key',
  };

  const networkMap: NetworkMap = {
    active: true,
    cfg: '1.0.0',
    messages: [],
  };

  return {
    transaction,
    networkMap,
    DataCache: {
      dbtrAcctId: 'test-debtor-account-id',
    },
  };
};

const ruleConfig: RuleConfig = {
  id: '902@1.0.0',
  cfg: '1.0.0',
  desc: 'Transaction amount exceeds 100',
  config: {
    parameters: {
      amountThreshold: 100,
    },
    exitConditions: [
      {
        subRuleRef: '.ALT',
        reason: 'Transaction amount exceeds 100',
      },
    ],
    bands: [],
  },
};

const ruleRes: RuleResult = {
  id: '902@1.0.0',
  cfg: '1.0.0',
  subRuleRef: '',
  reason: '',
};

describe('Rule-902 Tests', () => {
  let req: RuleRequest;

  beforeEach(() => {
    req = getMockRequest(0); // Her testten önce mock request sıfırlanır
  });

  test('Should trigger alert when amount exceeds 100', async () => {
    req = getMockRequest(150); // Tutar 150 olarak ayarlanır
    const res = await handleTransaction(req, ruleRes, loggerService, ruleConfig);

    expect(res).toEqual({
      ...ruleRes,
      subRuleRef: '.ALT',
      reason: 'Transaction amount exceeds 100',
    });
  });

  test('Should not trigger alert when amount is 100 or less', async () => {
    req = getMockRequest(100); // Tutar 100 olarak ayarlanır
    const res = await handleTransaction(req, ruleRes, loggerService, ruleConfig);

    expect(res).toEqual(ruleRes); // Alert tetiklenmez, orijinal sonuç döner
  });

  test('Should not trigger alert when amount is below 100', async () => {
    req = getMockRequest(50); // Tutar 50 olarak ayarlanır
    const res = await handleTransaction(req, ruleRes, loggerService, ruleConfig);

    expect(res).toEqual(ruleRes); // Alert tetiklenmez, orijinal sonuç döner
  });
});
