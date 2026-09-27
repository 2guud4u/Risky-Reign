import React from 'react';
import { CityPrice, SettlementPrice, SoldierPrice } from 'common';
import { buildButtonClass } from './styles';
import { priceLabel } from '../../utils/price';

interface VertexBuildActionsProps {
  canBuildSettlement: boolean;
  canUpgradeToCity: boolean;
  canRecruitSoldier: boolean;
  onBuildSettlement: () => void;
  onUpgradeToCity: () => void;
  onRecruitSoldier: () => void;
}

/**
 * Build-action buttons for the vertex sidebar: build a settlement, upgrade a
 * settlement to a city, and recruit a soldier. Each button renders only when
 * its eligibility flag (from `useBuildRules`) is set.
 */
const VertexBuildActions: React.FC<VertexBuildActionsProps> = ({
  canBuildSettlement,
  canUpgradeToCity,
  canRecruitSoldier,
  onBuildSettlement,
  onUpgradeToCity,
  onRecruitSoldier,
}) => (
  <>
    {canBuildSettlement && (
      <button
        onClick={onBuildSettlement}
        className={buildButtonClass}
        title={`Build settlement (${priceLabel(SettlementPrice)})`}
      >
        Build Settlement <span className="text-white text-xs">({priceLabel(SettlementPrice)})</span>
      </button>
    )}

    {canUpgradeToCity && (
      <button
        onClick={onUpgradeToCity}
        className={buildButtonClass}
        title={`Upgrade to city (${priceLabel(CityPrice)})`}
      >
        Upgrade to City <span className="text-white text-xs">({priceLabel(CityPrice)})</span>
      </button>
    )}

    {canRecruitSoldier && (
      <button
        onClick={onRecruitSoldier}
        className={buildButtonClass}
        title={`Recruit a soldier here (${priceLabel(SoldierPrice)})`}
      >
        ⚔ Recruit Soldier <span className="text-white text-xs">({priceLabel(SoldierPrice)})</span>
      </button>
    )}
  </>
);

export default VertexBuildActions;
