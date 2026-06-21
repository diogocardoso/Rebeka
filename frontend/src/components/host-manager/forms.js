import { APP } from '../../core/app.js';

export function HostForm(host = null, onSave) {
  const Form = new WA.Formulary();
  const isEdit = Boolean(host?.id);

  const View = {
    app() {
      Form.item.text('name', {
        label: '*Nome:',
        attr: { class: 'wa-form', value: host?.name || '' },
      });
      Form.item.text('baseUrl', {
        label: '*Base URL:',
        attr: { class: 'wa-form', value: host?.baseUrl || 'http://localhost:3000' },
      });

      Form.submit({ text: 'Salvar', color: 'purple' });

      Form.action(async (data) => {
        const name = data.values.name?.trim();
        const baseUrl = data.values.baseUrl?.trim();
        if (!name || !baseUrl) return;

        await onSave({ name, baseUrl });
        WA.box_closed('boxFormHost');
      });

      return Form.show();
    },
  };

  this.show = () => {
    APP.box('boxFormHost', {
      title: isEdit ? 'Editar Host' : 'Novo Host',
      width: '420px',
      content: View.app(),
    });
  };
}

export function MirrorBranchForm(sourceLabel, hosts, onMirror) {
  const Form = new WA.Formulary();
  const targets = (hosts || []);

  const View = {
    app() {
      Form.item.text('source', {
        label: 'Origem:',
        attr: { class: 'wa-form', value: sourceLabel, disabled: true },
      });

      if (targets.length) {
        Form.item.select('targetId', {
          label: '*Host destino:',
          attr: { class: 'wa-form' },
          options: Object.fromEntries(targets.map((h) => [h.id, h.name])),
        });
      }

      Form.submit({ text: 'Espelhar', color: 'purple' });

      Form.action(async (data) => {
        const targetId = data.values.targetId;
        if (!targetId) return;
        await onMirror(targetId);
        WA.box_closed('boxFormHost');
      });

      return Form.show();
    },
  };

  this.show = () => {
    APP.box('boxFormHost', {
      title: 'Espelhar para outro host',
      width: '420px',
      content: targets.length
        ? View.app()
        : '<p class="text-muted">Crie outro host para espelhar.</p>',
    });
  };
}

export function MirrorHostForm(sourceHost, hosts, onMirror) {
  const Form = new WA.Formulary();
  const targets = (hosts || []).filter((h) => h.id !== sourceHost.id);

  const View = {
    app() {
      Form.item.text('source', {
        label: 'Host origem:',
        attr: { class: 'wa-form', value: sourceHost.name, disabled: true },
      });

      if (targets.length) {
        Form.item.select('targetId', {
          label: '*Host destino:',
          attr: { class: 'wa-form' },
          options: Object.fromEntries(targets.map((h) => [h.id, h.name])),
        });
      }

      Form.submit({ text: 'Espelhar', color: 'purple' });

      Form.action(async (data) => {
        const targetId = data.values.targetId;
        if (!targetId) return;
        await onMirror(sourceHost.id, targetId);
        WA.box_closed('boxFormHost');
      });

      return Form.show();
    },
  };

  this.show = () => {
    APP.box('boxFormHost', {
      title: 'Espelhar estrutura',
      width: '420px',
      content: targets.length
        ? View.app()
        : '<p class="text-muted">Crie outro host para espelhar a estrutura.</p>',
    });
  };
}
