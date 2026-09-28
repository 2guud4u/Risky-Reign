import React, { useState } from 'react';
import { CityPrice, SettlementPrice, SoldierPrice, BuildCheck } from 'common';
import { priceLabel } from '../../utils/price';
import { ActionButton, ReasonNotice } from './ActionButton';

interface VertexActionsProps {
  settlementCheck: BuildCheck;
  cityCheck: BuildCheck;
  recruitCheck: BuildCheck;
  onBuildSettlement: () => void;
  onUpgradeToCity: () => void;
  onRecruitSoldier: () => void;
}

/**
 * The vertex's action buttons — always shown, greyed out when unavailable.
 * Clicking a greyed button surfaces the reason it can't be done here. The
 * checks come from `useBuildRules`, the same functions the backend enforces.
 */
const VertexBuildActions: React.FC<VertexActionsProps> = ({
  settlementCheck,
  cityCheck,
  recruitCheck,
  onBuildSettlement,
  onUpgradeToCity,
  onRecruitSoldier,
}) => {
  const [notice, setNotice] = useState<string | null>(null);
  const blocked = (reason: string) => setNotice(reason);

  return (
    <div className="flex flex-col gap-1.5">
      <ActionButton
        label={<>Build Settlement <span className="text-xs opacity-80">({priceLabel(SettlementPrice)})</span></>}
        check={settlementCheck}
        onDo={onBuildSettlement}
        onBlocked={blocked}
      />
      <ActionButton
        label={<>Upgrade to City <span className="text-xs opacity-80">({priceLabel(CityPrice)})</span></>}
        check={cityCheck}
        onDo={onUpgradeToCity}
        onBlocked={blocked}
      />
      <ActionButton
        label={<>⚔ Recruit Soldier <span className="text-xs opacity-80">({priceLabel(SoldierPrice)})</span></>}
        check={recruitCheck}
        onDo={onRecruitSoldier}
        onBlocked={blocked}
      />
      {notice && <ReasonNotice reason={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
};

export default VertexBuildActions;
