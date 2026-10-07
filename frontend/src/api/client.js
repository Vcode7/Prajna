const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });

    let responseData;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      const errorMsg = responseData?.detail || responseData || `HTTP error! status: ${response.status}`;
      throw new Error(typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg));
    }

    return responseData;
  } catch (error) {
    console.error(`API request error on ${endpoint}:`, error);
    throw error;
  }
}

export const api = {
  // ── Project Tree & Sessions ─────────────────────────────────
  getProjectTree: () => request('/projects/tree'),
  createProject: (name) => request('/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  updateProject: (id, name) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify({ name }) }),
  transformProjectData: (id, transformation_type, params = {}) =>
    request(`/projects/${id}/transform`, { method: 'POST', body: JSON.stringify({ transformation_type, params }) }),
  queryProjectData: (id, query, limit = 100) =>
    request(`/projects/${id}/query`, { method: 'POST', body: JSON.stringify({ query, limit }) }),
  chatProjectData: (id, message, model) =>
    request(`/projects/${id}/chat`, { method: 'POST', body: JSON.stringify({ message, model }) }),

  // ── Dashboard Stats ─────────────────────────────────────────
  getDashboardStats: () => request('/dashboard/stats'),

  // ── Datasets ───────────────────────────────────────────────
  uploadDataset: async (fileOrFiles, name, projectId, sheetName) => {
    const formData = new FormData();
    if (Array.isArray(fileOrFiles)) {
      fileOrFiles.forEach(f => formData.append('files', f));
      if (fileOrFiles.length > 0) {
        formData.append('file', fileOrFiles[0]);
      }
    } else if (typeof FileList !== 'undefined' && fileOrFiles instanceof FileList) {
      Array.from(fileOrFiles).forEach(f => formData.append('files', f));
      if (fileOrFiles.length > 0) {
        formData.append('file', fileOrFiles[0]);
      }
    } else if (fileOrFiles) {
      formData.append('file', fileOrFiles);
      formData.append('files', fileOrFiles);
    }
    if (name) formData.append('name', name);
    if (projectId) formData.append('project_id', projectId);
    if (sheetName) formData.append('sheet_name', sheetName);

    const response = await fetch(`${API_BASE}/datasets/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(err.detail || 'Upload failed');
    }
    return response.json();
  },

  listDatasets: () => request('/datasets'),
  getDataset: (id) => request(`/datasets/${id}`),
  getDatasetPreview: (id, limit = 100) => request(`/datasets/${id}/preview?limit=${limit}`),
  getDatasetSheets: (id) => request(`/datasets/${id}/sheets`),
  switchDatasetSheet: (id, sheetName) => request(`/datasets/${id}/switch-sheet`, {
    method: 'POST',
    body: JSON.stringify({ sheet_name: sheetName })
  }),
  deleteDataset: (id) => request(`/datasets/${id}`, { method: 'DELETE' }),
  exportDatasetUrl: (id) => `${API_BASE}/datasets/${id}/export`,
  getColumnUniqueValues: (id, column) => request(`/datasets/${id}/column-unique-values/${encodeURIComponent(column)}`),
  fixDatasetFormatting: (id) => request(`/datasets/${id}/fix-formatting`, { method: 'POST' }),
  getDatasetSchema: (id) => request(`/datasets/${id}/schema`),
  getProjectSchema: (id) => request(`/projects/${id}/schema`),
  getSchema: () => request('/schema'),

  // ── Visualizations ──────────────────────────────────────────
  listVisualizations: (datasetId, category) => {
    const url = `/visualizations?dataset_id=${datasetId}${category ? `&category=${category}` : ''}`;
    return request(url);
  },
  createVisualization: (data) => request('/visualizations', { method: 'POST', body: JSON.stringify(data) }),
  getVisualization: (id) => request(`/visualizations/${id}`),
  updateVisualization: (id, data) => request(`/visualizations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteVisualization: (id) => request(`/visualizations/${id}`, { method: 'DELETE' }),
  queryVisualizationData: (params) => request('/visualizations/query-data', { method: 'POST', body: JSON.stringify(params) }),
  chatToVisualizationSpec: (params) => request('/visualizations/chat-to-spec', { method: 'POST', body: JSON.stringify(params) }),
  generateVisualizationInsights: (params) => request('/visualizations/insights', { method: 'POST', body: JSON.stringify(params) }),
  generateWidgetInsights: (widgetId, title, sql, columns, rows, rowCount, model) =>
    request('/visualizations/insights', {
      method: 'POST',
      body: JSON.stringify({
        visualization_id: widgetId,
        title: title || 'Chart',
        chart_type: 'Bar',
        aggregated_data: rows || [],
        columns: columns || [],
        model
      })
    }),
  generateAiImportantVisualizations: (datasetId, model) =>
    request('/visualizations/generate-ai-important', { method: 'POST', body: JSON.stringify({ dataset_id: datasetId, model }) }),
  generateAiImportantVisualizationsStream: async (datasetId, model, onEvent) => {
    const url = `${API_BASE}/visualizations/generate-ai-important-stream`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dataset_id: datasetId, model })
    });

    if (!response.ok) {
      let errText = `HTTP error! status: ${response.status}`;
      try {
        const errJson = await response.json();
        errText = errJson.detail || errText;
      } catch (e) {
        try {
          errText = await response.text();
        } catch (_) {}
      }
      throw new Error(errText);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            if (onEvent) onEvent(data);
          } catch (e) {
            console.error('Failed to parse SSE event chunk:', trimmed, e);
          }
        }
      }
    }

    if (buffer.trim().startsWith('data: ')) {
      try {
        const data = JSON.parse(buffer.trim().slice(6));
        if (onEvent) onEvent(data);
      } catch (e) {}
    }
  },
  chatVisualizationAssistant: (params) => {
    const payload = {
      dataset_id: params.dataset_id,
      message: params.message || params.user_prompt || '',
      user_prompt: params.user_prompt || params.message || '',
      history: params.history || params.conversation_history || [],
      conversation_history: params.conversation_history || params.history || [],
      current_spec: params.current_spec || params.current_chart_spec || null,
      current_chart_spec: params.current_chart_spec || params.current_spec || null,
      model: params.model
    };
    return request('/visualizations/ai-chat', { method: 'POST', body: JSON.stringify(payload) });
  },

  // ── ML Training ─────────────────────────────────────────────
  detectProblemType: (datasetId, targetColumn) =>
    request('/ml/detect-problem', { method: 'POST', body: JSON.stringify({ dataset_id: datasetId, target_column: targetColumn }) }),
  getTechniques: (problemType) => request(`/ml/techniques?problem_type=${problemType}`),
  recommendMLMethod: (params) => request('/ml/recommend', { method: 'POST', body: JSON.stringify(params) }),
  getTargetCorrelation: (params) => request('/ml/target-correlation', { method: 'POST', body: JSON.stringify(params) }),
  aiDecideML: (params) => request('/ml/ai-decide', { method: 'POST', body: JSON.stringify(params) }),
  trainModel: (params) => request('/ml/train', { method: 'POST', body: JSON.stringify(params) }),
  listExperiments: (datasetId, chartId, workflowType) => {
    const params = new URLSearchParams();
    if (datasetId) params.append('dataset_id', datasetId);
    if (chartId) params.append('chart_id', chartId);
    if (workflowType) params.append('workflow_type', workflowType);
    const qs = params.toString();
    return request(`/ml/experiments${qs ? `?${qs}` : ''}`);
  },
  getExperiment: (id) => request(`/ml/experiments/${id}`),
  deleteExperiment: (id) => request(`/ml/experiments/${id}`, { method: 'DELETE' }),

  // ── Chart-Based Forecasting ML ──────────────────────────────
  trainChartForecast: (params) => request('/ml/chart-forecast/train', { method: 'POST', body: JSON.stringify(params) }),
  getChartForecastHistory: (chartId) => request(`/ml/chart-forecast/history/${chartId}`),
  activateChartForecast: (experimentId, chartId) =>
    request('/ml/chart-forecast/activate', { method: 'POST', body: JSON.stringify({ experiment_id: experimentId, chart_id: chartId }) }),
  getActiveChartForecast: (chartId) => request(`/ml/chart-forecast/active/${chartId}`),

  // ── Testing ─────────────────────────────────────────────────
  testModelWithFile: async (modelId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/testing/${modelId}/predict`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Prediction failed' }));
      throw new Error(err.detail || 'Prediction failed');
    }
    return response.json();
  },
  testModelWithRecords: (modelId, records) => {
    const formData = new FormData();
    formData.append('raw_data', JSON.stringify(records));
    return fetch(`${API_BASE}/testing/${modelId}/predict`, {
      method: 'POST',
      body: formData,
    }).then(res => {
      if (!res.ok) throw new Error('Prediction failed');
      return res.json();
    });
  },
  generateTestingInsights: (params) => request('/testing/insights', { method: 'POST', body: JSON.stringify(params) }),

  // ── Deployments ─────────────────────────────────────────────
  deployModel: (params) => request('/deployments', { method: 'POST', body: JSON.stringify(params) }),
  listDeployments: () => request('/deployments'),
  getDeployment: (id) => request(`/deployments/${id}`),
  updateDeployment: (id, params) => request(`/deployments/${id}`, { method: 'PUT', body: JSON.stringify(params) }),
  deleteDeployment: (id) => request(`/deployments/${id}`, { method: 'DELETE' }),
  downloadDeploymentModelUrl: (id) => `${API_BASE}/deployments/${id}/download`,
  runDeployedInference: (id, params) => request(`/deployments/${id}/predict`, { method: 'POST', body: JSON.stringify(params) }),
  generateDeploymentInsights: (id, params) => request(`/deployments/${id}/insights`, { method: 'POST', body: JSON.stringify(params) }),

  // ── Dashboards & Builder ─────────────────────────────────────
  createDashboard: (data) => request('/dashboards', { method: 'POST', body: JSON.stringify(data) }),
  listDashboards: (projectId) => request(`/dashboards${projectId ? `?project_id=${projectId}` : ''}`),
  getDashboard: (id) => request(`/dashboards/${id}`),
  updateDashboard: (id, data) => request(`/dashboards/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteDashboard: (id) => request(`/dashboards/${id}`, { method: 'DELETE' }),
  addVisualizationToDashboard: (dashboardId, data) =>
    request(`/dashboards/${dashboardId}/add-visualization`, { method: 'POST', body: JSON.stringify(data) }),
  generateDashboardForecast: (params) =>
    request('/dashboards/forecast', { method: 'POST', body: JSON.stringify(params) }),
  generateAIDashboard: (params) =>
    request('/dashboards/generate-ai', { method: 'POST', body: JSON.stringify(params) }),
  askAICardModification: (params) =>
    request('/dashboards/modify-card-ai', { method: 'POST', body: JSON.stringify(params) }),

  // ── Settings ───────────────────────────────────────────────
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'POST', body: JSON.stringify(payload) }),
};

export default api;
