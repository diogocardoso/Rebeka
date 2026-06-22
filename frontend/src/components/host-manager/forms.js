import { APP } from '../../core/app.js';

export function EnvironmentForm(environment = null, onSave) {
  const Form = new WA.Formulary();
  const isEdit = Boolean(environment?.id);

  const View = {
    app() {
      Form.item.text('name', {
        label: '*Nome:',
        attr: { class: 'wa-form', value: environment?.name || '' },
      });

      Form.item.text('baseUrl', {
        label: '*Base URL:',
        attr: { class: 'wa-form', value: environment?.baseUrl || 'http://localhost:3000' },
      });

      Form.submit({ text: 'Salvar', color: 'purple' });

      Form.action(async (data) => {
        const name = data.values.name?.trim();
        const baseUrl = data.values.baseUrl?.trim();
        if (!name || !baseUrl) return;
        await onSave({ name, baseUrl });
        WA.box_closed('boxFormEnvironment');
      });

      return Form.show();
    },
  };

  this.show = () => {
    APP.box('boxFormEnvironment', {
      title: isEdit ? 'Editar Ambiente' : 'Novo Ambiente',
      width: '420px',
      content: View.app(),
      btClose: true,
    });
  };
}
