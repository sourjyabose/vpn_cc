/**
 * CloudVPN+ Recharge Controller Module
 * Manages plan selection dropdown (1gb, 1.5gb, 2gb, 5gb, 10gb),
 * dynamic price calculation, user status display, and recharge transactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  const rechargeForm = document.getElementById('rechargeForm');
  const planSelect = document.getElementById('planSelect');
  const planAmountDisplay = document.getElementById('planAmount');
  const planValidityDisplay = document.getElementById('planValidity');
  const planSpeedDisplay = document.getElementById('planSpeed');
  const userEmailDisplay = document.getElementById('userEmailDisplay');
  const rechargeSubmitBtn = document.getElementById('rechargeSubmitBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Confirmation Modal Elements
  const rechargeModal = document.getElementById('rechargeModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalTxnId = document.getElementById('modalTxnId');
  const modalPlan = document.getElementById('modalPlan');
  const modalAmount = document.getElementById('modalAmount');

  // Defined CloudVPN+ High-Speed Data Packs
  const PLAN_DATA = {
    '1gb': {
      name: '1 GB Express Tunnel',
      data: '1 GB',
      price: '$1.99',
      numericPrice: 1.99,
      validity: '24 Hours',
      speed: 'Up to 300 Mbps'
    },
    '1.5gb': {
      name: '1.5 GB Plus Pass',
      data: '1.5 GB',
      price: '$2.99',
      numericPrice: 2.99,
      validity: '48 Hours',
      speed: 'Up to 500 Mbps'
    },
    '2gb': {
      name: '2 GB Weekly Boost',
      data: '2 GB',
      price: '$3.99',
      numericPrice: 3.99,
      validity: '7 Days',
      speed: 'Up to 1 Gbps'
    },
    '5gb': {
      name: '5 GB Ultra Shield',
      data: '5 GB',
      price: '$7.99',
      numericPrice: 7.99,
      validity: '30 Days',
      speed: 'Uncapped Premium'
    },
    '10gb': {
      name: '10 GB Enterprise Max',
      data: '10 GB',
      price: '$12.99',
      numericPrice: 12.99,
      validity: '60 Days',
      speed: 'Dedicated Low-Latency'
    }
  };

  // Populate active user session if available
  const currentUser = window.CloudVPNAPI ? window.CloudVPNAPI.getCurrentUser() : null;
  if (userEmailDisplay) {
    userEmailDisplay.textContent = currentUser ? currentUser.email : 'active_member@cloudvpn.plus';
  }

  // Update plan details card upon selection
  function updatePlanCard(planKey) {
    const plan = PLAN_DATA[planKey] || PLAN_DATA['1gb'];
    if (planAmountDisplay) planAmountDisplay.textContent = plan.price;
    if (planValidityDisplay) planValidityDisplay.textContent = plan.validity;
    if (planSpeedDisplay) planSpeedDisplay.textContent = plan.speed;
  }

  if (planSelect) {
    planSelect.addEventListener('change', (e) => {
      updatePlanCard(e.target.value);
    });
    // Initialize with default selected plan
    updatePlanCard(planSelect.value || '1gb');
  }

  // Handle Recharge Submission
  if (rechargeForm) {
    rechargeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const selectedPlanKey = planSelect.value;
      const plan = PLAN_DATA[selectedPlanKey];

      if (!plan) return;

      rechargeSubmitBtn.disabled = true;
      rechargeSubmitBtn.textContent = 'Processing Recharge...';

      try {
        const response = await window.CloudVPNAPI.processRecharge({
          plan: selectedPlanKey,
          amount: plan.price,
          userEmail: currentUser ? currentUser.email : 'user@cloudvpn.plus'
        });

        // Populate Modal Receipt
        if (modalTxnId) modalTxnId.textContent = response.transactionId || ('TXN_' + Math.floor(Math.random() * 899999 + 100000));
        if (modalPlan) modalPlan.textContent = plan.name + ' (' + plan.data + ')';
        if (modalAmount) modalAmount.textContent = plan.price;

        if (rechargeModal) {
          rechargeModal.classList.remove('hidden');
        }
      } catch (err) {
        alert('Recharge transaction error: ' + (err.message || 'Please try again.'));
      } finally {
        rechargeSubmitBtn.disabled = false;
        rechargeSubmitBtn.textContent = 'Confirm & Instant Recharge';
      }
    });
  }

  // Modal Dismiss Button
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => {
      if (rechargeModal) {
        rechargeModal.classList.add('hidden');
      }
    });
  }

  // Logout Handler
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.CloudVPNAPI) {
        window.CloudVPNAPI.clearSession();
      }
      window.location.href = 'login.html';
    });
  }
});
