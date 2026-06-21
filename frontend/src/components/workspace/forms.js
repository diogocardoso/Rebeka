import { APP } from '../../core/app.js';

export function WorkspaceForm(onSave) {
  const Form = new WA.Formulary();

  const View = {
    app() {
      Form.item.text('name', {
        label: '*Nome:',
        attr: { class: 'wa-form', value: 'Novo Workspace' },
      });

      Form.submit({ text: 'Salvar', color: 'purple' });

      Form.action(async (data) => {
        const name = data.values.name?.trim();
        if (!name) return;
        await onSave(name);
        WA.box_closed('boxFormWorkspace');
      });

      return Form.show();
    },
  };

  this.show = () => {
    APP.box('boxFormWorkspace', {
      title: 'Novo Workspace',
      width: '400px',
      content: View.app(),
    });
  };
}
