import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ShieldCheck, X, Clock, ArrowRight, Repeat } from 'lucide-react';
import { DraftRecoveryModal } from '../modals/DraftRecoveryModal';
import { ChangeIntakeTypeModal } from '../modals/ChangeIntakeTypeModal';
import { CameraCaptureModal } from '../common/CameraCaptureModal';
import { useBuyPawnWorkflow } from './buy-pawn/useBuyPawnWorkflow';
import { BuyPawnStepper } from './buy-pawn/BuyPawnStepper';
import { BuyPawnModeStep } from './buy-pawn/BuyPawnModeStep';
import { BuyPawnIdentityStep } from './buy-pawn/BuyPawnIdentityStep';
import { BuyPawnItemStep } from './buy-pawn/BuyPawnItemStep';
import { BuyPawnValuationStep } from './buy-pawn/BuyPawnValuationStep';
import { BuyPawnLocationStep } from './buy-pawn/BuyPawnLocationStep';
import { BuyPawnReviewStep } from './buy-pawn/BuyPawnReviewStep';
import { BuyPawnCompletion } from './buy-pawn/BuyPawnCompletion';
import { OperationProgressScreen } from '../common/OperationProgressScreen';

export type { WorkflowStep, TxType } from './buy-pawn/buyPawnTypes';

export const BuyPawn: React.FC = () => {
  const [isChangeTypeOpen, setIsChangeTypeOpen] = useState(false);
  const workflow = useBuyPawnWorkflow();
  const {
    step,
    txType,
    workflowSteps,
    currentStepIndex,
    drafts,
    images,
    marketCheck,
    actions,
    selectedIdentity,
    isCreatingIdentity,
    setIsCreatingIdentity,
    newIdentity,
    setNewIdentity,
    identitySearch,
    setIdentitySearch,
    filteredIdentities,
    itemData,
    setItemData,
    duplicateSerialMatch,
    retailPriceInput,
    setRetailPriceInput,
    isRetailPriceFromMarketCheck,
    setIsRetailPriceFromMarketCheck,
    costBasisInput,
    setCostBasisInput,
    agreedOffer,
    setAgreedOffer,
    isAgreedOfferFromMarketCheck,
    setIsAgreedOfferFromMarketCheck,
    suggestedRetail,
    setSuggestedRetail,
    existingStockStatus,
    setExistingStockStatus,
    basketItems,
    isFinalizing,
    result,
    pawnCalculations,
    businessRules,
    hasPermission,
    showToast,
    setActiveContractModal,
  } = workflow;

  return (
    <div className="relative flex-1 flex flex-col bg-stone-50/60 overflow-hidden font-sans text-stone-900 selection:bg-[#FDF0EA] selection:text-[#C85A32]">
      {/* Subtle Atmospheric Sky Background */}
      <div
        className="fixed inset-0 overflow-hidden pointer-events-none z-0 select-none"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-[#EEF4F8]/50 via-[#F7F7F5]/60 to-[#F6EFE8]/30" />
        <div className="cloud-layer-1 absolute -top-20 -left-20 w-[140%] h-[35%] opacity-15 filter blur-3xl" />
        <div className="cloud-layer-2 absolute top-[30%] -left-32 w-[150%] h-[35%] opacity-10 filter blur-[46px]" />
      </div>

      {/* Header bar */}
      <div className="relative z-10 px-6 lg:px-8 py-4 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shrink-0 shadow-xs">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#FDF0EA] text-[#C85A32] flex items-center justify-center font-bold shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#C85A32] uppercase tracking-wider">
                  Add Stock
                </span>
                {step !== 'mode' && (
                  <>
                    <span className="text-stone-300">/</span>
                    <span className="text-xs font-medium text-stone-500">
                      {txType === 'existing'
                        ? 'Existing Stock'
                        : txType === 'buy'
                        ? 'Buy From Person'
                        : 'Pawn'}
                    </span>
                  </>
                )}
              </div>
              <h2 className="text-base font-bold text-stone-900 leading-tight">
                {step === 'mode'
                  ? 'Intake Selection'
                  : txType === 'existing'
                  ? 'Add Existing Store Stock'
                  : txType === 'buy'
                  ? 'Buy Item From Person'
                  : 'Start Pawn Loan'}
              </h2>
            </div>
          </div>
          {step !== 'mode' && step !== 'completion' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsChangeTypeOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition cursor-pointer shadow-2xs"
                title="Switch between Buy From Person, Pawn Loan, or Existing Stock without losing item details or photos"
              >
                <Repeat className="w-3.5 h-3.5 text-amber-700" />
                <span>Change Intake Type</span>
              </button>
              <button
                type="button"
                onClick={actions.reset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel Intake</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto p-6 md:p-8 no-scrollbar">
        <div className="max-w-5xl mx-auto">
          {/* Progress Indicator */}
          {step !== 'completion' && step !== 'mode' && (
            <BuyPawnStepper steps={workflowSteps} currentStepIndex={currentStepIndex} />
          )}

          {/* Active Drafts Notice (Reassuring & Non-intrusive) */}
          {step === 'mode' && drafts.activeDrafts.length > 0 && (
            <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-white/95 border border-amber-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-auth-fade">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">You have unfinished work</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Continue where you left off:{' '}
                    <span className="font-semibold text-stone-700">
                      {drafts.activeDrafts[0].payload?.itemData?.title || 'Untitled intake'}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => drafts.handleContinueDraft(drafts.activeDrafts[0])}
                  className="px-4 py-2 bg-[#C85A32] hover:bg-[#B84E27] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => drafts.handleDiscardDraft(drafts.activeDrafts[0].id)}
                  className="px-3 py-2 border border-stone-200 text-stone-600 hover:text-rose-600 hover:bg-stone-50 rounded-xl text-xs font-medium transition cursor-pointer"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'mode' && (
              <BuyPawnModeStep
                onSelectTxType={actions.selectTxType}
                hasPermission={hasPermission}
              />
            )}

            {step === 'customer' && (
              <BuyPawnIdentityStep
                txType={txType}
                identitySearch={identitySearch}
                setIdentitySearch={setIdentitySearch}
                filteredIdentities={filteredIdentities}
                selectedIdentity={selectedIdentity}
                isCreatingIdentity={isCreatingIdentity}
                setIsCreatingIdentity={setIsCreatingIdentity}
                newIdentity={newIdentity}
                setNewIdentity={setNewIdentity}
                onSelectIdentity={actions.selectIdentity}
                onCreateIdentity={actions.createIdentity}
                onExplicitVerifyIdentity={actions.explicitVerifyIdentity}
                onClearSelectedIdentity={actions.clearSelectedIdentity}
                onBack={actions.back}
                onNext={actions.next}
              />
            )}

            {step === 'item' && (
              <BuyPawnItemStep
                itemData={itemData}
                setItemData={setItemData}
                txType={txType}
                duplicateSerialMatch={duplicateSerialMatch}
                photoUploadStatus={images.photoUploadStatus}
                photoMeta={images.photoMeta}
                photoFileInputRef={images.photoFileInputRef}
                onPhotoFileSelect={images.handlePhotoFileSelect}
                onOpenCamera={() => images.setIsCameraOpen(true)}
                onRemovePhoto={images.handleRemovePhoto}
                onBack={actions.back}
                onNext={actions.next}
              />
            )}

            {step === 'valuation' && (
              <BuyPawnValuationStep
                txType={txType}
                itemData={itemData}
                retailPriceInput={retailPriceInput}
                setRetailPriceInput={setRetailPriceInput}
                isRetailPriceFromMarketCheck={isRetailPriceFromMarketCheck}
                setIsRetailPriceFromMarketCheck={setIsRetailPriceFromMarketCheck}
                costBasisInput={costBasisInput}
                setCostBasisInput={setCostBasisInput}
                agreedOffer={agreedOffer}
                setAgreedOffer={setAgreedOffer}
                isAgreedOfferFromMarketCheck={isAgreedOfferFromMarketCheck}
                setIsAgreedOfferFromMarketCheck={setIsAgreedOfferFromMarketCheck}
                suggestedRetail={suggestedRetail}
                setSuggestedRetail={setSuggestedRetail}
                businessRules={businessRules}
                marketCheckData={marketCheck.marketCheckData}
                isMarketLoading={marketCheck.isMarketLoading}
                marketError={marketCheck.marketError}
                onRunMarketCheck={marketCheck.handleRunMarketCheck}
                onBack={actions.back}
                onNext={actions.next}
                onAbandon={actions.reset}
              />
            )}

            {step === 'location' && txType === 'existing' && (
              <BuyPawnLocationStep
                itemData={itemData}
                setItemData={setItemData}
                existingStockStatus={existingStockStatus}
                setExistingStockStatus={setExistingStockStatus}
                retailPriceInput={retailPriceInput}
                isFinalizing={isFinalizing}
                onBack={actions.back}
                onFinalize={actions.finalizeExistingStock}
              />
            )}

            {step === 'deal' && (txType === 'buy' || txType === 'pawn') && (
              <BuyPawnReviewStep
                txType={txType}
                itemData={itemData}
                selectedIdentity={selectedIdentity}
                basketItems={basketItems}
                agreedOffer={agreedOffer}
                isAgreedOfferFromMarketCheck={isAgreedOfferFromMarketCheck}
                pawnCalculations={pawnCalculations}
                businessRules={businessRules}
                isFinalizing={isFinalizing}
                onAddToBatch={actions.addToBatch}
                onFinalize={actions.finalize}
                onBack={actions.back}
              />
            )}

            {step === 'completion' && result && (
              <BuyPawnCompletion
                result={result}
                txType={txType}
                agreedOffer={agreedOffer}
                businessRules={businessRules}
                selectedIdentity={selectedIdentity}
                showToast={showToast}
                setActiveContractModal={setActiveContractModal}
                onReset={actions.reset}
              />
            )}
          </AnimatePresence>
        </div>

        {drafts.activeDrafts.length > 0 && (
          <DraftRecoveryModal
            drafts={drafts.activeDrafts}
            onContinue={drafts.handleContinueDraft}
            onDiscard={drafts.handleDiscardDraft}
          />
        )}

        <ChangeIntakeTypeModal
          isOpen={isChangeTypeOpen}
          onClose={() => setIsChangeTypeOpen(false)}
          currentTxType={txType}
          onSwitchTxType={actions.switchTxType}
          hasPermission={hasPermission}
          selectedIdentityName={selectedIdentity?.fullName}
        />

        <CameraCaptureModal
          isOpen={images.isCameraOpen}
          onClose={() => images.setIsCameraOpen(false)}
          onCapture={(blob, fileName) => images.handleProcessImage(blob, fileName)}
          title="Capture Item Photograph"
        />

        {/* OPERATION PROGRESS SCREEN */}
        <OperationProgressScreen state={workflow.finalizeProgress.state} />
      </div>
    </div>
  );
};
