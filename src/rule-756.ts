// SPDX-License-Identifier: Apache-2.0
import { type DatabaseManagerInstance, type LoggerService, type ManagerConfig } from '@frmscoe/frms-coe-lib';
import { type RuleConfig, type RuleRequest, type RuleResult } from '@frmscoe/frms-coe-lib/lib/interfaces';
export async function handleTransaction(
  req: RuleRequest,
  determineOutcome: (value: number, ruleConfig: RuleConfig, ruleResult: RuleResult) => RuleResult,
  ruleRes: RuleResult,
  loggerService: LoggerService,
  ruleConfig: RuleConfig,
  databaseManager: DatabaseManagerInstance<ManagerConfig>,
): Promise<RuleResult> {
  const context = `Rule-${ruleConfig?.id ? ruleConfig.id : '<unresolved>'} handleSimpleAlert()`;
  const msgId = req.transaction.FIToFIPmtSts.GrpHdr.MsgId;

  loggerService.trace('Start - handle simple alert', context, msgId);

  // Step 1: Check if the transaction amount is greater than 100
  loggerService.trace('Step 1 - Check transaction amount', context, msgId);

  const transactionAmount = req.transaction.FIToFIPmtSts.TxInfAndSts.ChrgsInf[0].Amt.Amt;

  if (transactionAmount > 100) {
    loggerService.trace('Transaction amount exceeds threshold, triggering alert', context, msgId);

    return determineOutcome(transactionAmount, ruleConfig, {
      ...ruleRes,
      subRuleRef: '.ALT', // Indicates that an alert is being generated
      reason: 'Transaction amount exceeds 100',
    });
  }

  // If the transaction amount does not exceed the threshold, return the original result
  loggerService.trace('End - handle simple alert, no alert triggered', context, msgId);

  return ruleRes;
}
